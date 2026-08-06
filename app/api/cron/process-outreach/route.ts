import { NextRequest, NextResponse } from "next/server";
import { type Document } from "mongodb";
import { Resend } from "resend";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import {
  composeOutreachEmail,
  type Lead,
  type Personalization,
} from "@/lib/outreach-templates";
import { getSendAllowance, bulkSenderHeaders, unsubscribeUrlFor } from "@/lib/sending-policy";
import { leadCollectionFor, resolveLead } from "@/lib/outreach-lead-resolver";

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
 * SINGLE SEND PATH: this route is now the ONLY sender. The two laptop scripts
 * (scripts/process-outreach-cron.mjs / .js) refuse to run unless
 * ALLOW_LAPTOP_OUTREACH_SENDER=yes, because they bypassed the business-hours
 * gate, the RFC 8058 unsubscribe headers, rendered-field bookkeeping, AND set
 * replyTo to admin@twinmile.com instead of OUTREACH_REPLY_TO — which silently
 * routed every reply away from /api/webhooks/resend-inbound.
 *
 * Schedule (vercel.json): every 15 minutes between 13:00-23:59 UTC. That band
 * is the only time the cold-template window below (Mon-Fri 08:00-18:00
 * America/Chicago) can ever be open under either DST offset; running every 15
 * minutes around the clock made ~60% of invocations structurally guaranteed
 * no-ops, which made a real stall indistinguishable from a scheduled defer.
 * The band deliberately still covers weekends: non-cold templates (quote and
 * driver confirmations) send any time, and stranding one until Monday would be
 * a worse bug than the log noise. The in-route gate below remains the
 * authority — a UTC cron expression cannot handle DST.
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

// leadCollectionFor / resolveLead now live in lib/outreach-lead-resolver.ts —
// lib/autoheal.ts imports the SAME functions so its "is this lead gone?" check
// can never be weaker than this route's actual lookup (it was, and it buried 59
// reachable prospects as permanently orphaned).

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

    // Daily send cap, derived from real send history rather than a static env
    // var (lib/sending-policy.ts). The old default was 100/day; sustained
    // ceilings that survive on a cold domain are 25-40/day, ramped over weeks.
    // The ramp advances by itself and env config can only lower it.
    const allowance = await getSendAllowance(db);
    const DAILY_CAP = allowance.dailyCap;
    const sentLast24h = allowance.sentLast24h;
    const capRemaining = allowance.remaining;
    const runLimit = Math.min(MAX_TASKS_PER_RUN, capRemaining);

    // Due tasks: pending/retrying and scheduled in the past, plus stale
    // "sending" tasks abandoned by a crashed run.
    const dueTaskFilter = {
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
    };

    // TRUE backlog size, measured before the run limit is applied. Reporting
    // tasks.length as "due" was an 8x under-count (5 fetched vs 41 overdue)
    // because runLimit collapses to the warmup ramp's 5/day — which is exactly
    // how a frozen queue read as "5 due, nothing urgent" for 26 days.
    const dueTotal = await db.collection("outreach_tasks").countDocuments(dueTaskFilter);

    if (runLimit === 0) {
      // Cap-full early exit still counts as a run: log the heartbeat so the
      // timesheet reflects that this invocation executed rather than stalled.
      const note = `Daily cap reached (${sentLast24h}/${DAILY_CAP} sent in last 24h) — resuming when the window rolls.`;
      await db.collection("agent_activity").insertOne({
        agent: "Outreach Processor",
        action: "outreach_cron_summary",
        activity: `Outreach run: 0 sent, 0 failed, 0 skipped, ${dueTotal} deferred of ${dueTotal} due (daily cap reached)`,
        type: "outreach",
        details: {
          dryRun: !live,
          dueTasks: dueTotal,
          sent: 0,
          failed: 0,
          skipped: 0,
          deferred: dueTotal,
          reason: "daily_cap_reached",
          capStatus: { sentLast24h, dailyCap: DAILY_CAP },
          source: "vercel-cron",
        },
        success: true,
        createdAt: now,
        timestamp: now,
      });

      return NextResponse.json({
        ok: true,
        report: {
          dueTasks: dueTotal, sent: 0, failed: 0, skipped: 0, deferred: dueTotal,
          note,
        },
      });
    }

    const tasks = await db
      .collection("outreach_tasks")
      .find(dueTaskFilter)
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
        activity: `Outreach dry-run: ${dueTotal} due task(s) (${tasks.length} fetched this run), nothing sent (OUTREACH_AUTOMATION != "live")`,
        type: "outreach",
        details: {
          dryRun: true,
          dueTasks: dueTotal,
          fetchedThisRun: tasks.length,
          dailyCap: DAILY_CAP,
          capRemaining,
          wouldSend,
          source: "vercel-cron",
        },
        // A dry run with due work is NOT a success. Hardcoded success:true is
        // what let 671 consecutive no-op runs read as 671 green runs while
        // zero mail left the building.
        success: dueTotal === 0,
        createdAt: now,
        timestamp: now,
      });

      return NextResponse.json({
        ok: true,
        dryRun: true,
        report: {
          dueTasks: dueTotal,
          fetchedThisRun: tasks.length,
          dailyCap: DAILY_CAP,
          capRemaining,
          sent: 0,
          failed: 0,
          skipped,
          deferred: 0,
          wouldSend,
        },
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

    // Cold outreach only goes out during business hours (America/Chicago,
    // Mon-Fri 8am-6pm) — the legacy laptop system respected this and the port
    // initially lost it. Transactional templates (quote/driver confirmations)
    // send any time.
    const COLD_TEMPLATES = new Set(["prospect_outreach", "onboarding_followup"]);
    const chiParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour12: false,
      hour: "numeric",
      weekday: "short",
    }).formatToParts(now);
    const chiHour = parseInt(chiParts.find((p) => p.type === "hour")?.value || "0", 10);
    const chiDay = chiParts.find((p) => p.type === "weekday")?.value || "";
    const inColdWindow = !["Sat", "Sun"].includes(chiDay) && chiHour >= 8 && chiHour < 18;

    for (const task of tasks) {
      if (COLD_TEMPLATES.has(task.template) && !inColdWindow) {
        // Outside business hours — leave the task pending for a later run.
        deferred++;
        continue;
      }

      // Suppression list: someone who unsubscribed must never be mailed again,
      // by any template or sequence. Checked per send rather than only at
      // queue time, because tasks are queued days before they go out.
      const taskEmail = typeof task.leadEmail === "string" ? task.leadEmail : "";
      if (taskEmail) {
        const suppressed = await db
          .collection("suppressions")
          .findOne({ email: taskEmail.toLowerCase() });
        if (suppressed) {
          await db.collection("outreach_tasks").updateOne(
            { _id: task._id },
            {
              $set: {
                status: "cancelled",
                cancelledReason: `recipient suppressed (${suppressed.reason || "unsubscribed"})`,
                updatedAt: new Date(),
              },
            }
          );
          skipped++;
          continue;
        }
      }

      // Per-prospect duplicate guard: never send the same template to the
      // same lead twice (requeues + legacy/new task overlap make this real).
      const dupe = await db.collection("outreach_tasks").findOne({
        _id: { $ne: task._id },
        leadId: task.leadId,
        template: task.template,
        status: "sent",
      });
      if (dupe) {
        await db.collection("outreach_tasks").updateOne(
          { _id: task._id },
          {
            $set: {
              status: "failed",
              error: `Duplicate: ${task.template} already sent to this lead (task ${dupe._id})`,
              updatedAt: new Date(),
            },
          }
        );
        skipped++;
        continue;
      }

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
          // Branded composition: template fragment wrapped in the Twin Mile
          // layout (header/logo/CTA/footer). renderedHtml persists the FULL
          // document so the admin preview is byte-identical to the send.
          const t = composeOutreachEmail(task.template, { ...lead, name: leadName }, p);
          // RFC 8058 one-click unsubscribe. Mandatory under the Gmail/Yahoo
          // bulk-sender rules, must work without a login, and must be honored
          // within 2 days — see app/unsubscribe and /api/unsubscribe.
          const unsubToken = String(p.token || task._id);
          const { data, error } = await resend.emails.send({
            from: FROM,
            to: leadEmail,
            subject: t.subject,
            replyTo: REPLY_TO,
            html: t.html,
            text: t.text,
            headers: bulkSenderHeaders(unsubscribeUrlFor(unsubToken)),
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

        // Stale-pointer heal: if the lead was only found via the email
        // fallback, write the corrected _id back. Otherwise every future run
        // repeats the expensive email scan, and autoheal keeps seeing a task
        // whose leadId points at nothing.
        const healedId =
          String(lead._id) !== String(task.leadId)
            ? { leadId: lead._id, leadIdHealedFrom: task.leadId, leadIdHealedAt: new Date() }
            : {};

        // Only mark sent AFTER the provider confirmed success.
        await db.collection("outreach_tasks").updateOne(
          { _id: task._id },
          {
            $set: {
              status: "sent",
              sentAt: new Date(),
              updatedAt: new Date(),
              error: null,
              ...healedId,
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
      activity: `Outreach run: ${sent} sent, ${failed} failed, ${skipped} skipped, ${deferred} deferred of ${dueTotal} due (${tasks.length} fetched this run)`,
      type: "outreach",
      details: {
        dryRun: false,
        dueTasks: dueTotal,
        fetchedThisRun: tasks.length,
        dailyCap: DAILY_CAP,
        capRemaining,
        sent,
        failed,
        skipped,
        deferred,
        errors,
        source: "vercel-cron",
      },
      success: failed === 0,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      report: {
        dueTasks: dueTotal,
        fetchedThisRun: tasks.length,
        dailyCap: DAILY_CAP,
        capRemaining,
        sent,
        failed,
        skipped,
        deferred,
        errors,
      },
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
 * Flips matching failed OR abandoned tasks back to "pending" (attempts reset)
 * so the regular 15-minute runs re-attempt them under the daily cap. Used to
 * revive the legacy laptop-era tasks that failed with bare "Lead not found".
 *
 * "abandoned" is included deliberately: autoheal quarantined 59 tasks as
 * permanently orphaned using an _id-only aliveness check, but this route's
 * resolver finds all 59 by email. A status this route cannot reach is a status
 * those prospects can never come back from.
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
  const revivable = { $in: ["failed", "abandoned"] };
  const candidates = await db
    .collection("outreach_tasks")
    .find({ status: revivable, error: { $regex: escaped } })
    .project({ _id: 1 })
    .limit(limit)
    .toArray();

  const ids = candidates.map((c: any) => c._id);
  const result = ids.length
    ? await db.collection("outreach_tasks").updateMany(
        { _id: { $in: ids }, status: revivable },
        {
          $set: {
            status: "pending",
            attempts: 0,
            error: null,
            scheduledAt: new Date(),
            requeuedAt: new Date(),
            requeuedReason: `requeue_failed:${errorMatch}`,
          },
          // Retire the fossil `attempt` counter and the quarantine stamps.
          // Leaving `attempt` behind is what let autoheal's
          // reconcile_attempt_counters push attempts straight back to 2
          // ~150ms after a requeue reset it to 0.
          $unset: { attempt: "", abandonedAt: "", abandonedReason: "" },
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
