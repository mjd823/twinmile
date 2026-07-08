import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import clientPromise from "@/lib/mongodb";
import { renderReplyDraft } from "@/lib/outreach-templates";

/**
 * POST /api/webhooks/resend-inbound
 *
 * Resend inbound-email webhook receiver ("email.received" events). Captures
 * prospect replies to outreach emails into the `outreach_replies` collection,
 * marks the matching prospect as replied, and (OUTREACH_AUTOREPLY=draft,
 * the default) prepares a suggested response that an admin can one-click send
 * from /admin/outreach.
 *
 * ============================ ONE-TIME SETUP ============================
 * Resend can only receive mail on a domain whose MX records point at Resend.
 * Do NOT change MX on twinmile.com (that would break the real admin@ mailbox);
 * use the already-verified sending subdomain contact.twinmile.com instead:
 *
 *   1. Resend dashboard -> Domains -> contact.twinmile.com -> enable
 *      "Receiving" and add the MX record it shows to the DNS for
 *      contact.twinmile.com (the dashboard displays the exact host/value/
 *      priority). No mailbox exists on that subdomain, so this is safe.
 *   2. Resend dashboard -> Webhooks -> Add Webhook:
 *        URL:    https://twinmile.com/api/webhooks/resend-inbound
 *        Event:  email.received
 *      Copy the webhook's signing secret (whsec_...) into the
 *      RESEND_WEBHOOK_SECRET env var on Vercel.
 *   3. Set OUTREACH_REPLY_TO=reply@contact.twinmile.com on Vercel so outreach
 *      replies are delivered to Resend (any address at the subdomain works).
 * ========================================================================
 *
 * SIGNATURE VERIFICATION: when RESEND_WEBHOOK_SECRET is set, events are
 * verified with Resend's svix-based `webhooks.verify()` and rejected (401) on
 * mismatch. If the secret is not configured yet, events are accepted but
 * stored with verified:false, and auto-send (OUTREACH_AUTOREPLY=live) is
 * refused for unverified events.
 *
 * BODY FETCH: Resend's email.received webhook payload contains metadata only
 * (no body), so the full text/html is fetched from the Received-emails API
 * (GET /emails/receiving/{id}) using RESEND_API_KEY.
 *
 * IDEMPOTENCY: replies are upserted by Resend email_id, so svix retries and
 * duplicate deliveries never double-log or double-draft.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ONBOARDING_SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // same as onboarding-invites cron
const SITE_URL = "https://twinmile.com";

function extractEmail(value: unknown): string {
  const s = String(value || "").trim();
  const angle = s.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angle) return angle[1].toLowerCase();
  const bare = s.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/);
  return bare ? bare[0].toLowerCase() : "";
}

function extractDisplayName(value: unknown): string {
  const s = String(value || "").trim();
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : "";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function matchSender(db: any, fromEmail: string) {
  if (!fromEmail) return { matchedProspectId: null, matchedCollection: null, matchedDoc: null };
  const emailRegex = new RegExp(`^${escapeRegex(fromEmail)}$`, "i");

  const prospect = await db
    .collection("outbound_prospects")
    .findOne({ $or: [{ "contact.email": emailRegex }, { email: emailRegex }] });
  if (prospect) {
    return {
      matchedProspectId: prospect._id,
      matchedCollection: "outbound_prospects",
      matchedDoc: prospect,
    };
  }

  for (const coll of ["leads_quotes", "leads_drivers"]) {
    const lead = await db
      .collection(coll)
      .findOne({ $or: [{ email: emailRegex }, { "contact.email": emailRegex }] });
    if (lead) {
      return { matchedProspectId: lead._id, matchedCollection: coll, matchedDoc: lead };
    }
  }

  return { matchedProspectId: null, matchedCollection: null, matchedDoc: null };
}

/** Reuse the prospect's onboarding session, or create one (same token scheme
 *  as /api/cron/onboarding-invites) so the draft response can link to it. */
async function ensureOnboardingUrl(db: any, prospect: any, email: string): Promise<string | null> {
  try {
    const existing = await db.collection("onboarding_sessions").findOne({
      email,
      leadType: "outbound_prospect",
    });
    if (existing?.rawToken) return `${SITE_URL}/onboarding?token=${existing.rawToken}`;

    const now = new Date();
    const rawToken = crypto.randomUUID();
    await db.collection("onboarding_sessions").insertOne({
      name: prospect?.name || "",
      email,
      leadType: "outbound_prospect",
      status: "pending",
      rawToken,
      expiresAt: new Date(now.getTime() + ONBOARDING_SESSION_EXPIRY_MS),
      metadata: {
        aiScore: prospect?.aiScore ?? null,
        source: prospect?.source || "",
        phone: prospect?.contact?.phone || "",
        createdBy: "resend-inbound-webhook",
      },
      createdAt: now,
    });
    return `${SITE_URL}/onboarding?token=${rawToken}`;
  } catch (err) {
    console.error("[webhooks/resend-inbound] onboarding session error:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!clientPromise) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // ------------------------- verify / parse -------------------------
  let event: any;
  let verified = false;
  if (webhookSecret) {
    try {
      // verify() is local svix HMAC verification -- the placeholder key is
      // only needed because the Resend constructor requires one.
      const verifier = new Resend(RESEND_API_KEY || "re_webhook_verify_only");
      event = verifier.webhooks.verify({
        payload,
        headers: {
          id: request.headers.get("svix-id") || "",
          timestamp: request.headers.get("svix-timestamp") || "",
          signature: request.headers.get("svix-signature") || "",
        },
        webhookSecret,
      });
      verified = true;
    } catch (err) {
      console.error("[webhooks/resend-inbound] Signature verification failed:", err);
      return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
    }
  } else {
    try {
      event = JSON.parse(payload);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
    }
  }

  if (!event || event.type !== "email.received") {
    // Not an inbound email (e.g. email.delivered) -- acknowledge and ignore.
    return NextResponse.json({ ok: true, ignored: true, type: event?.type || "unknown" });
  }

  const data = event.data || {};
  const emailId: string = data.email_id || "";
  const fromEmail = extractEmail(data.from);
  const fromName = extractDisplayName(data.from);
  const now = new Date();

  try {
    const client = await clientPromise;
    const db = client.db();

    // ---------------- fetch full body (webhook has metadata only) ----------------
    let text: string | null = null;
    let html: string | null = null;
    if (emailId && RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        const { data: full, error } = await resend.emails.receiving.get(emailId);
        if (!error && full) {
          text = full.text ?? null;
          html = full.html ?? null;
        }
      } catch (err) {
        console.error("[webhooks/resend-inbound] Body fetch failed:", err);
      }
    }
    const snippet = (text || html?.replace(/<[^>]+>/g, " ") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    // ---------------- match sender to a prospect/lead ----------------
    const { matchedProspectId, matchedCollection, matchedDoc } = await matchSender(db, fromEmail);

    // ---------------- idempotent insert ----------------
    const dedupKey = emailId || `${fromEmail}:${data.message_id || data.created_at || now.toISOString()}`;
    const upsert = await db.collection("outreach_replies").updateOne(
      { dedupKey },
      {
        $setOnInsert: {
          dedupKey,
          emailId: emailId || null,
          messageId: data.message_id || null,
          from: data.from || "",
          fromEmail,
          fromName,
          to: data.to || [],
          subject: data.subject || "",
          text,
          html,
          snippet,
          receivedAt: data.created_at ? new Date(data.created_at) : now,
          matchedProspectId,
          matchedCollection,
          verified,
          status: "received",
          raw: data,
          createdAt: now,
        },
      },
      { upsert: true }
    );
    if (!upsert.upsertedId) {
      // Already processed (svix retry / duplicate delivery) -- do nothing else.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    const replyId = upsert.upsertedId;

    // ---------------- bump the matched prospect/lead ----------------
    if (matchedProspectId && matchedCollection) {
      if (matchedCollection === "outbound_prospects") {
        // Always record repliedAt; only flip status forward to "replied" from
        // pre-reply stages so we never demote an onboarded/active prospect.
        await db.collection("outbound_prospects").updateOne(
          { _id: matchedProspectId },
          { $set: { repliedAt: now, updatedAt: now } }
        );
        await db.collection("outbound_prospects").updateOne(
          {
            _id: matchedProspectId,
            status: { $in: ["new", "reviewed", "contacted", "onboarding_invited"] },
          },
          { $set: { status: "replied" } }
        );
      } else {
        await db
          .collection(matchedCollection)
          .updateOne({ _id: matchedProspectId }, { $set: { repliedAt: now, updatedAt: now } });
      }

      await db.collection("agent_activity").insertOne({
        agent: { name: "Marcus Chen", role: "Sales Director", department: "Sales" },
        action: "prospect_reply_received",
        activity: `Reply received from ${matchedDoc?.name || fromName || fromEmail}: "${(data.subject || "").slice(0, 80)}"`,
        type: "outreach",
        result: {
          replyId: replyId.toString(),
          from: fromEmail,
          subject: data.subject || "",
          snippet,
          matchedCollection,
          matchedId: matchedProspectId.toString(),
        },
        success: true,
        createdAt: now,
        timestamp: now,
      });
    }

    // ---------------- auto-draft (default) / auto-send (live) ----------------
    const autoreplyMode = (process.env.OUTREACH_AUTOREPLY || "draft").toLowerCase();
    let drafted = false;
    let autoSent = false;
    if (autoreplyMode === "draft" || autoreplyMode === "live") {
      let onboardingUrl: string | null = null;
      if (matchedCollection === "outbound_prospects" && fromEmail) {
        onboardingUrl = await ensureOnboardingUrl(db, matchedDoc, fromEmail);
      }
      const draft = renderReplyDraft({
        name: matchedDoc?.name || fromName || null,
        originalSubject: data.subject || null,
        onboardingUrl,
      });
      await db.collection("outreach_replies").updateOne(
        { _id: replyId },
        {
          $set: {
            draftResponse: {
              subject: draft.subject,
              html: draft.html,
              text: draft.text,
              onboardingUrl,
              generatedAt: now,
              mode: autoreplyMode,
            },
          },
        }
      );
      drafted = true;

      // Live auto-send: same safety pattern as OUTREACH_AUTOMATION -- must be
      // exactly "live", and the event must be signature-verified.
      if (autoreplyMode === "live" && verified && RESEND_API_KEY && fromEmail) {
        try {
          const resend = new Resend(RESEND_API_KEY);
          const FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
          const REPLY_TO =
            process.env.OUTREACH_REPLY_TO ||
            process.env.RESEND_NOTIFY_TO ||
            "admin@twinmile.com";
          const { data: sendData, error: sendError } = await resend.emails.send({
            from: FROM,
            to: fromEmail,
            subject: draft.subject,
            replyTo: REPLY_TO,
            html: draft.html,
            text: draft.text,
          });
          if (sendError) throw new Error(sendError.message || "Resend send failed");
          await db.collection("outreach_replies").updateOne(
            { _id: replyId },
            {
              $set: {
                status: "responded",
                responseSentAt: new Date(),
                responseResendId: sendData?.id || null,
                responseSentBy: "auto (OUTREACH_AUTOREPLY=live)",
              },
            }
          );
          await db.collection("agent_activity").insertOne({
            agent: { name: "Marcus Chen", role: "Sales Director", department: "Sales" },
            action: "prospect_reply_sent",
            activity: `Auto-replied to ${matchedDoc?.name || fromEmail}: "${draft.subject.slice(0, 80)}"`,
            type: "outreach",
            result: { replyId: replyId.toString(), to: fromEmail, auto: true },
            success: true,
            createdAt: new Date(),
            timestamp: new Date(),
          });
          autoSent = true;
        } catch (err) {
          console.error("[webhooks/resend-inbound] Auto-send failed (draft kept):", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      replyId: replyId.toString(),
      matched: Boolean(matchedProspectId),
      matchedCollection,
      verified,
      drafted,
      autoSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhooks/resend-inbound] Fatal error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
