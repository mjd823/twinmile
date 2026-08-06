import { NextRequest, NextResponse } from "next/server";
import type { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { runFmcsaProspecting, SOFIA } from "@/lib/fmcsa-prospecting-core";
import { getSendAllowance } from "@/lib/sending-policy";

/**
 * GET /api/cron/prospecting
 *
 * Vercel cron port of scripts/fmcsa-prospecting.mjs -- Sofia Rodriguez's
 * daily FMCSA Company Census prospecting run (previously the laptop Hermes
 * job "Sofia — Outbound Prospecting", 8AM CT).
 *
 * Core logic lives in lib/fmcsa-prospecting-core.ts and is shared with the
 * on-demand "outbound_prospecting" admin action (agent dashboard button).
 *
 * Env (all optional):
 *   FMCSA_TARGET_STATES  comma list, default "TX,LA,CA,GA,TN"
 *   FMCSA_MAX_RESULTS    default 30
 *   SOCRATA_APP_TOKEN    higher Socrata rate limits
 *
 * ALWAYS logs a run record to agent_activity (action: "fmcsa_prospecting",
 * agent: Sofia Rodriguez) -- same action name the admin cron monitor watches.
 *
 * ALSO ENQUEUES (see enqueueProspectOutreach below): harvesting prospects and
 * queueing nothing is why the outreach queue has a finite bottom.
 *
 * Schedule (vercel.json): "0 13 * * *" UTC = 8AM CDT / 7AM CST.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Queue first-touch outreach for harvested prospects.
 *
 * WHY THIS EXISTS: nothing had inserted an outreach_task in 7 days while 1,411
 * prospects with a valid email sat at status "new". The 1,802 historical sends
 * all came from scripts/seed-outreach-tasks.js — a laptop script that no longer
 * runs. The only scheduled inserter left (onboarding-invites) handles the
 * "qualified" tier only, so the sub-threshold pool was harvested and abandoned:
 * once the 38 live tasks drain, the queue hits permanent zero and the machine
 * looks healthy while doing nothing.
 *
 * Bounded by the warmup ramp on purpose (lib/sending-policy.ts). Queueing more
 * per day than the domain may send just builds a backlog of tasks whose
 * scheduledAt is a lie, which is how a "5 due" report hid 41 overdue rows.
 *
 * Gated on OUTREACH_AUTOMATION=live for the same reason: enqueuing while
 * sending is paused manufactures stale work.
 */
async function enqueueProspectOutreach(db: Db, now: Date) {
  if (process.env.OUTREACH_AUTOMATION !== "live") {
    return { enqueued: 0, considered: 0, reason: "outreach automation paused" };
  }

  const { dailyCap } = await getSendAllowance(db);
  if (dailyCap <= 0) return { enqueued: 0, considered: 0, reason: "daily cap is zero" };

  // Best-scoring un-contacted prospects first. Headroom on the fetch because
  // some candidates get dropped by the per-lead task and suppression checks.
  const candidates = await db
    .collection("outbound_prospects")
    .find({
      status: "new",
      "contact.email": { $type: "string", $ne: "" },
    })
    .sort({ priorityScore: -1, aiScore: -1 })
    .limit(dailyCap * 5)
    .toArray();

  const tasks: Record<string, unknown>[] = [];
  for (const p of candidates) {
    if (tasks.length >= dailyCap) break;
    const email = String(p.contact?.email || "").trim();
    if (!email) continue;

    // Never queue a second first-touch for the same lead, in any state.
    const existing = await db
      .collection("outreach_tasks")
      .findOne({ leadId: p._id, template: "prospect_outreach" });
    if (existing) continue;

    // Suppression is checked again at send time, but queueing a suppressed
    // address at all is a compliance smell worth avoiding.
    const suppressed = await db
      .collection("suppressions")
      .findOne({ email: email.toLowerCase() });
    if (suppressed) continue;

    const state = String(p.location || "").split(",")[1]?.trim() || p.state || "";
    tasks.push({
      leadId: p._id,
      leadType: "outbound_prospect",
      leadEmail: email,
      leadName: p.name || p.dbaName || "Carrier",
      template: "prospect_outreach",
      channel: "email",
      priority: "medium",
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: now,
      personalization: { name: p.name || p.dbaName || "", state },
      createdAt: now,
      queuedBy: "cron/prospecting",
    });
  }

  if (!tasks.length) {
    return { enqueued: 0, considered: candidates.length, reason: "no eligible prospects" };
  }
  const result = await db.collection("outreach_tasks").insertMany(tasks);
  return { enqueued: result.insertedCount, considered: candidates.length, dailyCap };
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

  try {
    const client = await clientPromise;
    const db = client.db();

    const report = await runFmcsaProspecting(db);

    const now = new Date();
    const enqueue = await enqueueProspectOutreach(db, now);

    // Heartbeat for the cron monitor -- same action name the laptop job used.
    await db.collection("agent_activity").insertOne({
      action: "fmcsa_prospecting",
      agent: SOFIA,
      result: {
        carriersFound: report.carriersFound,
        qualified: report.qualified,
        saved: report.saved,
        targetStates: report.targetStates,
        outreachQueued: enqueue.enqueued,
        outreachQueueDetail: enqueue,
        dataSource: "FMCSA Company Census API (data.transportation.gov)",
        source: "vercel-cron",
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({
      ok: true,
      report: {
        carriersFound: report.carriersFound,
        qualified: report.qualified,
        saved: report.saved,
        targetStates: report.targetStates,
        outreachQueued: enqueue.enqueued,
        outreachQueueDetail: enqueue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/prospecting] Fatal error:", error);

    // Best-effort failure log so a stall is visible in the cron monitor.
    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "fmcsa_prospecting",
        agent: SOFIA,
        result: { error: message, source: "vercel-cron" },
        success: false,
        createdAt: new Date(),
        timestamp: new Date(),
      });
    } catch {
      // DB unreachable -- nothing more we can do.
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
