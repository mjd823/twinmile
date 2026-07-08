import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { Resend } from "resend";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import {
  renderOutreachEmail,
  type Lead,
  type Personalization,
} from "@/lib/outreach-templates";

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

// Templates live in lib/outreach-templates.ts (shared with the admin outreach
// dashboard, which re-renders legacy tasks sent before renderedSubject/
// renderedBody were persisted).

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function calculateBackoff(attempt: number) {
  return BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
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

    // Daily send cap: protects the Resend quota and, more importantly, the
    // sending domain's reputation — a fresh domain mass-blasting hundreds of
    // cold emails in one day is how you end up in spam folders forever.
    const DAILY_CAP = Math.max(0, parseInt(process.env.OUTREACH_DAILY_CAP || "100", 10) || 100);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sentLast24h = await db
      .collection("outreach_tasks")
      .countDocuments({ status: "sent", sentAt: { $gte: dayAgo } });
    const capRemaining = Math.max(0, DAILY_CAP - sentLast24h);
    const runLimit = Math.min(MAX_TASKS_PER_RUN, capRemaining);
    if (runLimit === 0) {
      return NextResponse.json({
        ok: true,
        report: {
          dueTasks: 0, sent: 0, failed: 0, skipped: 0, deferred: 0,
          note: `Daily cap reached (${sentLast24h}/${DAILY_CAP} sent in last 24h) — resuming when the window rolls.`,
        },
      });
    }

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
      .limit(runLimit)
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
    // Explicit reply-to for outreach. Point OUTREACH_REPLY_TO at an address on
    // a Resend-receiving domain (e.g. reply@contact.twinmile.com) so replies
    // flow into /api/webhooks/resend-inbound and show up on /admin/outreach.
    const REPLY_TO =
      process.env.OUTREACH_REPLY_TO ||
      process.env.RESEND_NOTIFY_TO ||
      "admin@twinmile.com";

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
        // Exact content as sent -- persisted on the task so the admin
        // outreach dashboard can show precisely what each recipient received.
        let renderedFields: Record<string, unknown> = {};
        if (task.channel === "email") {
          const t = renderOutreachEmail(task.template, { ...lead, name: leadName }, p);
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
          renderedFields = {
            renderedSubject: t.subject,
            renderedBody: t.text,
            renderedHtml: t.html,
            sentTo: leadEmail,
            sentFrom: FROM,
            replyTo: REPLY_TO,
            resendId: data?.id || null,
          };
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
            $set: {
              status: "sent",
              sentAt: new Date(),
              updatedAt: new Date(),
              error: null,
              ...renderedFields,
            },
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

/**
 * POST — maintenance actions (cron-secret gated).
 * { "action": "requeue_failed", "errorMatch": "Lead not found", "limit": 1000 }
 * Flips matching failed tasks back to "pending" (attempts reset) so the
 * regular 15-minute runs re-attempt them under the daily cap. Used to revive
 * the ~955 legacy laptop-era tasks that failed with bare "Lead not found".
 */
export async function POST(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;
  if (!clientPromise) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // empty body fine
  }
  if (body?.action !== "requeue_failed") {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const errorMatch = typeof body.errorMatch === "string" && body.errorMatch.trim()
    ? body.errorMatch.trim()
    : "Lead not found";
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 1000, 1), 5000);

  const client = await clientPromise;
  const db = client.db();

  // Escape regex metacharacters so errorMatch is treated as a literal prefix.
  const escaped = errorMatch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = await db
    .collection("outreach_tasks")
    .find({ status: "failed", error: { $regex: escaped } })
    .project({ _id: 1 })
    .limit(limit)
    .toArray();

  const ids = candidates.map((c: any) => c._id);
  const result = ids.length
    ? await db.collection("outreach_tasks").updateMany(
        { _id: { $in: ids }, status: "failed" },
        {
          $set: {
            status: "pending",
            attempts: 0,
            error: null,
            scheduledAt: new Date(),
            requeuedAt: new Date(),
            requeuedReason: `requeue_failed:${errorMatch}`,
          },
        }
      )
    : { modifiedCount: 0 };

  await db.collection("agent_activity").insertOne({
    agent: "Outreach Processor",
    action: "outreach_requeue",
    activity: `Requeued ${result.modifiedCount} failed outreach tasks (error match: "${errorMatch}") for retry under the daily cap`,
    type: "outreach",
    details: { requeued: result.modifiedCount, errorMatch, source: "maintenance" },
    success: true,
    createdAt: new Date(),
    timestamp: new Date(),
  });

  return NextResponse.json({ ok: true, requeued: result.modifiedCount, errorMatch });
}
