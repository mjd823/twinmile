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

    // Diagnostic samples (shape only, no PII beyond ids/types) for remote debugging
    const [failedSample] = await db
      .collection("outreach_tasks")
      .find({ status: "failed", error: /Lead not found/ })
      .sort({ createdAt: -1 })
      .limit(1)
      .project({ leadId: 1, leadType: 1, leadEmail: 1, template: 1, createdAt: 1, attempts: 1, error: 1 })
      .toArray();
    const [prospectSample] = await db
      .collection("outbound_prospects")
      .find({ status: "onboarding_invited" })
      .sort({ _id: -1 })
      .limit(1)
      .project({ _id: 1, status: 1, aiScore: 1 })
      .toArray();
    const diagnostics = {
      failedTaskSample: failedSample
        ? { ...failedSample, leadIdType: typeof failedSample.leadId, leadIdCtor: failedSample.leadId?.constructor?.name }
        : null,
      prospectSample: prospectSample
        ? { idType: typeof prospectSample._id, idCtor: prospectSample._id?.constructor?.name, id: String(prospectSample._id), status: prospectSample.status }
        : null,
    };

    // Source-distribution: prospects by sourceTag so the timesheet/hub shows
    // Sofia's channels (census / new-authority / insurance-lapse) working.
    // Legacy docs without a sourceTag are the original census channel.
    const bySourceTag = await db
      .collection("outbound_prospects")
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $ifNull: ["$sourceTag", "fmcsa-census"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Failure-reason breakdown so mass failures are diagnosable remotely
    const failureReasons = await db
      .collection("outreach_tasks")
      .aggregate<{ _id: string | null; count: number }>([
        { $match: { status: "failed" } },
        { $group: { _id: { $ifNull: ["$error", "(no error recorded)"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray();

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
          bySource: bySourceTag.map((r) => ({ sourceTag: r._id, count: r.count })),
        },
        outreach: {
          sentLast24h: outreachSentToday,
          pending: outreachPending,
          failed: outreachFailed,
          failureReasons: failureReasons.map((r) => ({ reason: r._id, count: r.count })),
        },
        onboarding: {
          sessionsPending,
          sessionsCompleted,
        },
        fleet: { trucks },
      },
      diagnostics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/admin/agent-status] GET error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
