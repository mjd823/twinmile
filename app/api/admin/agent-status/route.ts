import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { computeJobStatuses } from "@/lib/agent-status";

/**
 * GET /api/admin/agent-status
 *
 * CRON_SECRET-gated JSON "timesheet" for the Mission Control hub (and for
 * Claude to check "who's clocked in") -- call with either header:
 *   Authorization: Bearer <CRON_SECRET>
 *   x-cron-secret: <CRON_SECRET>
 *
 * For every scheduled job in lib/cron-jobs.ts it reports the last
 * agent_activity timestamp, whether the job ran within its expected window,
 * and the last run's result payload; plus headline business counts
 * (prospects, outreach, onboarding, fleet).
 *
 * NOTE: this replaces an earlier UNAUTHENTICATED route at the same path
 * that returned dashboard persona blurbs and had no consumers in the repo.
 *
 * Response shape:
 * {
 *   ok: true,
 *   generatedAt: ISO string,
 *   chicagoWeekday: "Monday",
 *   summary: { totalJobs, onTime, late, error, neverRan, allClockedIn },
 *   jobs: [{
 *     id, name, agent, schedule, cadence, expectedEveryHours,
 *     lastRun: ISO|null, hoursSinceLastRun: number|null,
 *     onTime: boolean, lastSuccess: boolean|null,
 *     status: "on_time"|"late"|"error"|"never_ran",
 *     lastResult: object|null
 *   }],
 *   metrics: {
 *     prospects: { total, qualified, invited },
 *     outreach: { sentLast24h, pending, failed },
 *     onboarding: { sessionsPending, sessionsCompleted },
 *     fleet: { trucks }
 *   }
 * }
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const client = await clientPromise;
    const db = client.db();

    // ── Per-job timesheet rows (shared with the admin UI) ─────────────────
    const statusReport = await computeJobStatuses(db, now);
    const jobs = statusReport.jobs;

    // ── Headline business counts ───────────────────────────────────────────
    const [
      prospectsTotal,
      prospectsQualified,
      prospectsInvited,
      outreachSentToday,
      outreachPending,
      outreachFailed,
      sessionsPending,
      sessionsCompleted,
      trucks,
    ] = await Promise.all([
      db.collection("outbound_prospects").countDocuments(),
      db.collection("outbound_prospects").countDocuments({ aiScore: { $gte: 75 } }),
      db.collection("outbound_prospects").countDocuments({ status: "onboarding_invited" }),
      db.collection("outreach_tasks").countDocuments({ status: "sent", sentAt: { $gte: dayAgo } }),
      db.collection("outreach_tasks").countDocuments({ status: { $in: ["pending", "retrying"] } }),
      db.collection("outreach_tasks").countDocuments({ status: "failed" }),
      db.collection("onboarding_sessions").countDocuments({ status: "pending" }),
      db.collection("onboarding_sessions").countDocuments({ status: "completed" }),
      db.collection("trucks").countDocuments(),
    ]);

    return NextResponse.json({
      ok: true,
      generatedAt: statusReport.generatedAt,
      chicagoWeekday: statusReport.chicagoWeekday,
      summary: statusReport.summary,
      jobs,
      metrics: {
        prospects: {
          total: prospectsTotal,
          qualified: prospectsQualified,
          invited: prospectsInvited,
        },
        outreach: {
          sentLast24h: outreachSentToday,
          pending: outreachPending,
          failed: outreachFailed,
        },
        onboarding: {
          sessionsPending,
          sessionsCompleted,
        },
        fleet: { trucks },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/admin/agent-status] GET error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
