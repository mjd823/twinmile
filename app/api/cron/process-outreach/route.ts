import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { Resend } from "resend";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/cron/process-outreach
 *
 * Vercel cron port of scripts/process-outreach-cron.mjs (previously ran on the
 * owner's laptop agent system). Sends due outreach_tasks emails via Resend
 * using the same templates.
 *
 * DOUBLE-SEND SAFETY (critical): every task is claimed with an atomic
 * findOneAndUpdate (status pending/retrying -> "sending") before any email is
 * sent. If the legacy laptop cron -- or a second Vercel invocation -- races us,
 * only one claimant wins; the loser sees null and skips the task. A task is
 * only marked "sent" after Resend confirms success; failures go to
 * "retrying"/"failed" with the error recorded, never "sent".
 *
 * SAFETY GATE: unless process.env.OUTREACH_AUTOMATION === "live", this runs in
 * dry-run mode -- it reports what WOULD send but claims nothing and sends
 * nothing.
 *
 * Schedule (vercel.json): every 15 minutes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TASKS_PER_RUN = 25;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;
// Tasks stuck in "sending" longer than this (e.g. a crashed run) are reclaimed.
const STALE_SENDING_MS = 15 * 60 * 1000;

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// Leads come from heterogeneous collections (leads_quotes, leads_drivers,
// outbound_prospects) with different shapes -- same loose typing as the
// legacy script.
type Lead = any;
type Personalization = any;

// Same templates as scripts/process-outreach-cron.mjs
const EMAIL_TEMPLATES: Record<
  string,
  {
    subject: (lead: Lead) => string;
    html: (lead: Lead, p: Personalization) => string;
    text: (lead: Lead, p: Personalization) => string;
  }
> = {
  quote_initial: {
    subject: (lead) => `Your ${lead.serviceType || "freight"} quote request -- Twin Mile`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Thank you for requesting a quote for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nThank you for requesting a quote for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.`,
  },
  quote_followup: {
    subject: (lead) => `Following up: Your ${lead.serviceType || "freight"} quote`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Following up on your quote request for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nFollowing up on your quote request for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.`,
  },
  driver_welcome: {
    subject: (lead) => `Welcome to Twin Mile -- Your ${lead.truckType || "driving"} application`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Thank you for applying to drive with Twin Mile! We've received your application for ${lead.truckType || "driving"}.</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nThank you for applying to drive with Twin Mile! We've received your application for ${lead.truckType || "driving"}.`,
  },
  driver_followup: {
    subject: () => `Next steps for your Twin Mile application`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Following up on your application to drive with Twin Mile (${lead.truckType || "driving"}).</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nFollowing up on your application to drive with Twin Mile (${lead.truckType || "driving"}).`,
  },
  prospect_outreach: {
    subject: (lead) => `${lead.name || "Your business"} — Drive with Twin Mile`,
    html: (lead, p) =>
      `<p>Hi ${p.name || lead.name},</p><p>We found your carrier on FMCSA and wanted to reach out about partnering with Twin Mile. We're looking for owner-operators like yourself to join our fleet.</p><p><strong>Why Twin Mile?</strong></p><ul><li>Competitive pay per mile</li><li>Flexible scheduling</li><li>24/7 driver support</li></ul><p>Ready to learn more? <a href="https://twinmile.com/drive-with-us">Click here to get started</a> or reply to this email.</p><p>Best regards,<br/>Twin Mile Recruiting Team</p>`,
    text: (lead, p) =>
      `Hi ${p.name || lead.name},\n\nWe found your carrier on FMCSA and wanted to reach out about partnering with Twin Mile. We're looking for owner-operators like yourself to join our fleet.\n\nWhy Twin Mile?\n- Competitive pay per mile\n- Flexible scheduling\n- 24/7 driver support\n\nReady to learn more? Visit https://twinmile.com/drive-with-us or reply to this email.\n\nBest regards,\nTwin Mile Recruiting Team`,
  },
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function calculateBackoff(attempt: number) {
  return BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
}

function getTemplate(name: string, lead: Lead, p: Personalization) {
  const t = EMAIL_TEMPLATES[name];
  if (!t) throw new Error(`Unknown template: ${name}`);
  return { subject: t.subject(lead), html: t.html(lead, p), text: t.text(lead, p) };
}

function leadCollectionFor(task: any): string {
  if (task.leadType === "quote") return "leads_quotes";
  if (task.leadType === "outbound_prospect") return "outbound_prospects";
  if (task.leadCollection === "outbound_prospects") return "outbound_prospects";
  return "leads_drivers";
}

async function resolveLead(db: any, task: any): Promise<Lead | null> {
  const coll = leadCollectionFor(task);
  // leadId may be stored as string or ObjectId -- try both
  let lead = await db.collection(coll).findOne({ _id: task.leadId });
  if (!lead && typeof task.leadId === "string") {
    try {
      lead = await db.collection(coll).findOne({ _id: new ObjectId(task.leadId) });
    } catch {
      // not a valid ObjectId string
    }
  }
  if (!lead && task.leadEmail) {
    lead = await db
      .collection(coll)
      .findOne({ $or: [{ "contact.email": task.leadEmail }, { email: task.leadEmail }] });
  }
  return lead;
}

async function logActivity(db: any, task: any, lead: Lead, result: any, status: string) {
  await db.collection("agent_activity").insertOne({
    timestamp: new Date(),
    createdAt: new Date(),
    agent: "Outreach Processor",
    action: "outreach_processing", // recognized by /api/admin/cron-monitor
    activity: `Outreach ${status}: ${task.template} to ${lead.name}`,
    type: "outreach",
    details: {
      taskId: task._id.toString(),
      leadId: task.leadId,
      leadType: task.leadType,
      channel: task.channel,
      template: task.template,
      priority: task.priority,
      status,
      attempts: (task.attempts || 0) + 1,
      result,
      sentAt: status === "sent" ? new Date() : null,
    },
    success: status === "sent",
  });
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  const live = process.env.OUTREACH_AUTOMATION === "live";
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_SENDING_MS);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deferred = 0;
  const errors: { taskId: string; error: string }[] = [];
  const wouldSend: { taskId: string; template: string; to: string; priority: string }[] = [];

  try {
    const client = await clientPromise;
    const db = client.db();

    // Due tasks: pending/retrying and scheduled in the past, plus stale
    // "sending" tasks abandoned by a crashed run.
    const tasks = await db
      .collection("outreach_tasks")
      .find({
        $or: [
          {
            status: { $in: ["pending", "retrying"] },
            scheduledAt: { $lte: now },
            attempts: { $lt: MAX_ATTEMPTS },
          },
          {
            status: "sending",
            claimedAt: { $lte: staleCutoff },
            attempts: { $lt: MAX_ATTEMPTS },
          },
        ],
      })
      .sort({ scheduledAt: 1 })
      .limit(MAX_TASKS_PER_RUN)
      .toArray();

    tasks.sort((a: any, b: any) => {
      const d = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (d !== 0) return d;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

    // ------------------------- DRY-RUN MODE -------------------------
    // Claims nothing, sends nothing. Reports what a live run would do.
    if (!live) {
      for (const task of tasks) {
        const to = task.leadEmail || "(no email)";
        if (task.channel === "email" && !task.leadEmail) {
          skipped++;
        }
        wouldSend.push({
          taskId: task._id.toString(),
          template: task.template,
          to,
          priority: task.priority,
        });
      }

      await db.collection("agent_activity").insertOne({
        agent: "Outreach Processor",
        action: "outreach_cron_summary",
        activity: `Outreach dry-run: ${tasks.length} due task(s), nothing sent (OUTREACH_AUTOMATION != "live")`,
        type: "outreach",
        details: { dryRun: true, dueTasks: tasks.length, wouldSend, source: "vercel-cron" },
        success: true,
        createdAt: now,
        timestamp: now,
      });

      return NextResponse.json({
        ok: true,
        dryRun: true,
        report: { dueTasks: tasks.length, sent: 0, failed: 0, skipped, deferred: 0, wouldSend },
      });
    }

    // -------------------------- LIVE MODE ---------------------------
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY is not configured" },
        { status: 500 }
      );
    }
    const resend = new Resend(RESEND_API_KEY);
    const FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const REPLY_TO = process.env.RESEND_NOTIFY_TO || "admin@twinmile.com";

    for (const task of tasks) {
      // ATOMIC CLAIM: transition this exact task from its observed state to
      // "sending". If the legacy laptop cron (or a parallel invocation)
      // already grabbed it, the filter no longer matches and we get null --
      // guaranteeing we can never double-send.
      const claimFilter: Document = { _id: task._id, status: task.status };
      if (task.status === "sending") {
        // Stale-claim recovery: only steal if it's still the same stale claim.
        claimFilter.claimedAt = task.claimedAt;
      }
      const claimed = await db.collection("outreach_tasks").findOneAndUpdate(claimFilter, {
        $set: { status: "sending", claimedAt: new Date(), claimedBy: "vercel-cron", updatedAt: new Date() },
      });
      if (!claimed) {
        deferred++;
        continue;
      }

      let lead: Lead = null;
      try {
        lead = await resolveLead(db, task);
        if (!lead) {
          throw new Error(
            `Lead not found in ${leadCollectionFor(task)}: leadId=${task.leadId} (leadType: ${task.leadType}), email=${task.leadEmail}`
          );
        }

        // Normalize -- outbound_prospects use nested contact.email/phone.
        const leadName = lead.name || lead.company || lead.legal_name || "Carrier";
        const leadEmail = lead.email || lead.contact?.email || task.leadEmail;
        const leadPhone = lead.phone || lead.contact?.phone || null;

        if (task.channel === "email" && (!leadEmail || String(leadEmail).trim() === "")) {
          // No email address -- terminally skip so it isn't retried forever.
          await db.collection("outreach_tasks").updateOne(
            { _id: task._id },
            {
              $set: {
                status: "failed",
                error: "No email address for lead",
                updatedAt: new Date(),
              },
              $inc: { attempts: 1 },
            }
          );
          skipped++;
          continue;
        }

        const p: Personalization = {
          ...task.personalization,
          name: leadName,
          email: leadEmail,
          phone: leadPhone,
          serviceType: lead.serviceType,
          pickupLocation: lead.pickupLocation,
          dropoffLocation: lead.dropoffLocation,
          truckType: lead.truckType,
          yearsExperience: lead.yearsExperience,
          company: lead.company,
        };

        let sendResult: { success: boolean; id?: string; mock?: boolean; error?: string };
        if (task.channel === "email") {
          const t = getTemplate(task.template, { ...lead, name: leadName }, p);
          const { data, error } = await resend.emails.send({
            from: FROM,
            to: leadEmail,
            subject: t.subject,
            replyTo: REPLY_TO,
            html: t.html,
            text: t.text,
          });
          if (error) throw new Error(error.message || "Resend send failed");
          sendResult = { success: true, id: data?.id };
        } else if (task.channel === "sms") {
          // SMS is still a placeholder (no provider wired up) -- same as legacy.
          if (!leadPhone) throw new Error("No phone number for SMS task");
          sendResult = { success: true, mock: true };
        } else {
          throw new Error(`Unknown channel: ${task.channel}`);
        }

        // Only mark sent AFTER the provider confirmed success.
        await db.collection("outreach_tasks").updateOne(
          { _id: task._id },
          {
            $set: { status: "sent", sentAt: new Date(), updatedAt: new Date(), error: null },
            $inc: { attempts: 1 },
          }
        );
        await logActivity(db, task, { ...lead, name: leadName }, sendResult, "sent");
        sent++;
        await sleep(100);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const nextAttempts = (task.attempts || 0) + 1;
        const exhausted = nextAttempts >= (task.maxAttempts || MAX_ATTEMPTS);
        // Failure: back to retrying (with backoff) or failed. NEVER "sent".
        await db.collection("outreach_tasks").updateOne(
          { _id: task._id },
          {
            $set: {
              status: exhausted ? "failed" : "retrying",
              error: message,
              updatedAt: new Date(),
              scheduledAt: exhausted
                ? task.scheduledAt
                : new Date(Date.now() + calculateBackoff(nextAttempts)),
            },
            $inc: { attempts: 1 },
          }
        );
        const fallbackLead = lead || { name: task.leadName || "Unknown", email: task.leadEmail || "N/A" };
        await logActivity(
          db,
          task,
          fallbackLead,
          { success: false, error: message },
          exhausted ? "failed" : "retrying"
        );
        failed++;
        errors.push({ taskId: task._id.toString(), error: message });
        await sleep(100);
      }
    }

    // Run summary -- always logged so the cron monitor sees a heartbeat.
    await db.collection("agent_activity").insertOne({
      agent: "Outreach Processor",
      action: "outreach_cron_summary",
      activity: `Outreach run: ${sent} sent, ${failed} failed, ${skipped} skipped, ${deferred} deferred of ${tasks.length} due`,
      type: "outreach",
      details: { dryRun: false, dueTasks: tasks.length, sent, failed, skipped, deferred, errors, source: "vercel-cron" },
      success: failed === 0,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      report: { dueTasks: tasks.length, sent, failed, skipped, deferred, errors },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/process-outreach] Fatal error:", error);

    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        agent: "Outreach Processor",
        action: "outreach_cron_summary",
        activity: `Outreach run failed: ${message}`,
        type: "outreach",
        details: { error: message, sent, failed, skipped, deferred, source: "vercel-cron" },
        success: false,
        createdAt: new Date(),
        timestamp: new Date(),
      });
    } catch {
      // DB unreachable -- nothing more we can do.
    }

    return NextResponse.json(
      { ok: false, error: message, report: { sent, failed, skipped, deferred } },
      { status: 500 }
    );
  }
}
