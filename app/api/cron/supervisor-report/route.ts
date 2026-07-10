import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { CRON_JOBS, classifyCronJob, lastActivityFor } from "@/lib/cron-jobs";
import { getPipelineCounts, QUALIFIED_SCORE_THRESHOLD } from "@/lib/pipeline-stages";
import { generateSupervisorAnalysis } from "@/lib/supervisor-llm";

/**
 * GET /api/cron/supervisor-report
 *
 * The AI Supervisor's daily report. Every number is computed live from Mongo:
 *
 *   - pipeline counts (the canonical taxonomy in lib/pipeline-stages.ts)
 *   - outreach queue health (pending / sent today / failed + WHY they failed)
 *   - cron health via the ONE shared classification (lib/cron-jobs.ts
 *     classifyCronJob) — jobs waiting for their first slot are "scheduled",
 *     never false-alarmed as stale/never-ran
 *   - per-agent activity summary (last seen + 24h task count)
 *   - deterministic bottleneck detection (ground truth), then an LLM analysis
 *     pass (lib/supervisor-llm.ts) that turns the same real signals into
 *     root-cause findings with a suggested fix and an autoFixable flag for
 *     the hub fleet watchdog path (Projects/hub: lib/watchdog.ts).
 *
 * The LLM may not invent findings — it only explains the deterministic
 * signals it is given, and the report writes fine without it if the LLM is
 * unavailable (analysis: null + analysisError).
 *
 * Writes the report to agent_activity as action "supervisor_monitoring" with
 * result.source "vercel-cron" (the admin page filters on that source, so the
 * still-running legacy external "daily_3x_scan" writer can never shadow it).
 *
 * Schedule (vercel.json): "0 12 * * *" UTC.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPERVISOR = {
  name: "AI Supervisor",
  role: "System Monitor",
  department: "Operations",
};

/** Remediations the hub fleet watchdog can actually run — the ONLY things the LLM may mark autoFixable. */
const KNOWN_AUTO_FIXES = [
  "Archive/cancel orphaned outreach tasks whose lead record no longer exists (error 'Lead not found')",
  "Requeue failed outreach tasks whose error was transient (rate limit / timeout)",
];

/** Match createdAt stored as either Date or ISO string (both exist in this DB). */
function sinceFilter(field: string, since: Date) {
  return { $or: [{ [field]: { $gte: since } }, { [field]: { $gte: since.toISOString() } }] };
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

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const client = await clientPromise;
    const db = client.db();

    // ── Pipeline counts — the canonical taxonomy (lib/pipeline-stages) ──────
    const [pipelineCounts, awaitingInvite, newProspectsToday, leaseSigned, newDriverLeads] =
      await Promise.all([
        getPipelineCounts(db),
        // Status "qualified" + score >= threshold = exactly what the invite
        // cron consumes ("awaiting invite" — the qualified stage's resting count).
        db.collection("outbound_prospects").countDocuments({
          status: "qualified",
          aiScore: { $gte: QUALIFIED_SCORE_THRESHOLD },
        }),
        db.collection("outbound_prospects").countDocuments(sinceFilter("createdAt", dayAgo)),
        db.collection("lease_agreements").countDocuments(),
        db.collection("leads_drivers").countDocuments({ status: "new" }),
      ]);
    const stageByKey = new Map(pipelineCounts.stages.map((s) => [s.key, s]));
    const onboardingInvited = stageByKey.get("invited")?.reached ?? 0;
    const sessionsCompleted = stageByKey.get("completed")?.reached ?? 0;

    // ── Outreach queue (counts + WHY things failed, not just how many) ─────
    const [outreachPending, outreachSentToday, outreachFailed, failureBreakdownRaw] =
      await Promise.all([
        db.collection("outreach_tasks").countDocuments({ status: { $in: ["pending", "retrying"] } }),
        db.collection("outreach_tasks").countDocuments({ status: "sent", sentAt: { $gte: dayAgo } }),
        db.collection("outreach_tasks").countDocuments({ status: "failed" }),
        db
          .collection("outreach_tasks")
          .aggregate([
            { $match: { status: "failed" } },
            {
              $group: {
                _id: { error: { $ifNull: ["$error", "unknown error"] }, template: "$template" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ])
          .toArray(),
      ]);
    const failureBreakdown = failureBreakdownRaw.map((r: any) => ({
      error: String(r._id?.error ?? "unknown error").slice(0, 200),
      template: r._id?.template ? String(r._id.template) : null,
      count: r.count as number,
    }));
    const outreachPaused = process.env.OUTREACH_AUTOMATION !== "live";

    // ── Fleet ──────────────────────────────────────────────────────────────
    const trucksInFleet = await db.collection("trucks").countDocuments();

    // ── Cron health — the ONE shared classification ────────────────────────
    const cronJobs = await Promise.all(
      CRON_JOBS.map(async (job) => {
        const last = await lastActivityFor(db, job.actions);
        const hoursSince = last.at
          ? (now.getTime() - last.at.getTime()) / 3600000
          : null;
        const cls = classifyCronJob(job, { at: last.at, success: last.success }, now);
        return {
          id: job.id,
          name: job.name,
          schedule: job.schedule,
          cadence: job.cadence,
          responsible: job.agentName,
          lastRun: last.at,
          hoursSinceLastRun: hoursSince === null ? null : Math.round(hoursSince * 10) / 10,
          status: cls.status,
          reason: cls.reason,
          nextExpectedRun: cls.nextExpectedRun,
        };
      })
    );
    const cronHealth = {
      totalJobs: cronJobs.length,
      healthy: cronJobs.filter((j) => j.status === "healthy").length,
      // Waiting for a slot that hasn't happened yet — NOT unhealthy.
      scheduled: cronJobs.filter((j) => j.status === "scheduled").length,
      stale: cronJobs.filter((j) => j.status === "stale").length,
      error: cronJobs.filter((j) => j.status === "error").length,
      neverRan: cronJobs.filter((j) => j.status === "never_ran").length,
      jobs: cronJobs,
    };

    // ── Per-agent activity summary ─────────────────────────────────────────
    const agentNames = Array.from(new Set(CRON_JOBS.map((j) => j.agentName)));
    const agentActivity: Record<string, { lastSeen: Date | null; tasks24h: number }> = {};
    await Promise.all(
      agentNames.map(async (name) => {
        const nameFilter = { $or: [{ agent: name }, { "agent.name": name }] };
        const [rows, tasks24h] = await Promise.all([
          db
            .collection("agent_activity")
            .find(nameFilter)
            .sort({ createdAt: -1, timestamp: -1 })
            .limit(1)
            .toArray(),
          db.collection("agent_activity").countDocuments({
            ...nameFilter,
            ...sinceFilter("createdAt", dayAgo),
          }),
        ]);
        const lastSeen = rows[0]?.createdAt || rows[0]?.timestamp || null;
        agentActivity[name] = { lastSeen: lastSeen ? new Date(lastSeen) : null, tasks24h };
      })
    );

    // ── Bottleneck detection (deterministic — ground truth) ────────────────
    const bottlenecks: { severity: "critical" | "warning"; description: string }[] = [];

    if (pipelineCounts.hasAnomaly) {
      const flagged = pipelineCounts.stages.filter((s) => s.anomaly).map((s) => s.label);
      bottlenecks.push({
        severity: "critical",
        description: `Funnel count anomaly: stage(s) ${flagged.join(", ")} exceed the previous stage's cumulative count. Counts are NOT clamped — investigate data drift.`,
      });
    }
    if (awaitingInvite > 0) {
      const inviteJob = cronJobs.find((j) => j.id === "onboarding-invites");
      bottlenecks.push({
        severity:
          !outreachPaused && inviteJob && inviteJob.status !== "healthy" ? "critical" : "warning",
        description: `${awaitingInvite} qualified prospect(s) (status "qualified", aiScore >= ${QUALIFIED_SCORE_THRESHOLD}) awaiting onboarding invites${outreachPaused ? " — outreach automation is PAUSED, so this is expected until it goes live" : `. Invite cron status: ${inviteJob?.status ?? "unknown"}.`}`,
      });
    }
    if (trucksInFleet === 0 && (onboardingInvited > 0 || sessionsCompleted > 0)) {
      bottlenecks.push({
        severity: "critical",
        description: `0 trucks in fleet while the onboarding pipeline is active (${onboardingInvited} invited, ${sessionsCompleted} completed). Cannot dispatch drivers without trucks.`,
      });
    }
    if (outreachFailed > 0) {
      const top = failureBreakdown[0];
      bottlenecks.push({
        severity: "warning",
        description: `${outreachFailed} outreach task(s) in failed state${top ? ` — most common: "${top.error}" (${top.count}x${top.template ? `, template ${top.template}` : ""})` : ""}.`,
      });
    }
    if (outreachPending > 50) {
      bottlenecks.push({
        severity: "warning",
        description: `Outreach backlog: ${outreachPending} pending/retrying tasks${outreachPaused ? " — expected while outreach automation is PAUSED; they will drain once it goes live" : ""}.`,
      });
    }
    for (const job of cronJobs) {
      // "scheduled" is waiting for its first slot — only genuine misses alarm.
      if (job.status === "stale" || job.status === "error" || job.status === "never_ran") {
        bottlenecks.push({
          severity: "critical",
          description: `Cron "${job.name}" is ${job.status.replace("_", " ")}: ${job.reason}`,
        });
      }
    }

    // ── LLM analysis pass — explains the deterministic signals ─────────────
    const deployment = {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 200) || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    };
    let analysis: Awaited<ReturnType<typeof generateSupervisorAnalysis>> | null = null;
    let analysisError: string | null = null;
    try {
      analysis = await generateSupervisorAnalysis({
        generatedAt: now.toISOString(),
        outreachAutomation: outreachPaused ? "paused (owner decision — do not re-enable)" : "live",
        pipeline: {
          stages: pipelineCounts.stages.map((s) => ({
            stage: s.label,
            reachedCumulative: s.reached,
            parkedHereNow: s.inStage,
          })),
          offFunnel: pipelineCounts.offFunnel.map((b) => ({ bucket: b.label, count: b.count })),
          totals: pipelineCounts.totals,
          awaitingInvite,
          newProspectsLast24h: newProspectsToday,
          qualifiedScoreThreshold: QUALIFIED_SCORE_THRESHOLD,
          note: "Below-75 prospects are never re-scored automatically; a manual re-score action pulls fresh FMCSA data.",
        },
        outreach: {
          pending: outreachPending,
          sentLast24h: outreachSentToday,
          failed: outreachFailed,
          failureBreakdown,
        },
        fleet: { trucks: trucksInFleet },
        cronHealth: {
          totalJobs: cronHealth.totalJobs,
          healthy: cronHealth.healthy,
          waitingForFirstSlot: cronHealth.scheduled,
          stale: cronHealth.stale,
          error: cronHealth.error,
          neverRan: cronHealth.neverRan,
          jobs: cronJobs.map((j) => ({
            name: j.name,
            cadence: j.cadence,
            status: j.status,
            why: j.reason,
            lastRun: j.lastRun ? j.lastRun.toISOString() : null,
          })),
        },
        deterministicFindings: bottlenecks,
        latestDeployment: deployment,
        knownAutoFixes: KNOWN_AUTO_FIXES,
      });
    } catch (err) {
      analysisError = err instanceof Error ? err.message : String(err);
      console.error("[cron/supervisor-report] LLM analysis unavailable:", analysisError);
    }

    const report = {
      // Canonical funnel: every stage carries BOTH counts, clearly named.
      pipeline: {
        stages: pipelineCounts.stages.map((s) => ({
          key: s.key,
          label: s.label,
          reached: s.reached,
          inStage: s.inStage,
          anomaly: s.anomaly ?? false,
        })),
        offFunnel: pipelineCounts.offFunnel.map((b) => ({ key: b.key, label: b.label, count: b.count })),
        totals: pipelineCounts.totals,
        hasAnomaly: pipelineCounts.hasAnomaly,
        awaitingInvite,
        onboardingInvited,
        onboardingCompleted: sessionsCompleted,
        leaseAgreements: leaseSigned,
        newProspectsToday,
        newDriverLeads,
      },
      outreach: {
        pending: outreachPending,
        sentLast24h: outreachSentToday,
        failed: outreachFailed,
        failureBreakdown,
        automation: outreachPaused ? "paused" : "live",
      },
      fleet: { trucks: trucksInFleet },
      cronHealth,
      agentActivity,
      bottlenecks,
      bottleneckSeverity: bottlenecks.some((b) => b.severity === "critical")
        ? "critical"
        : bottlenecks.length > 0
          ? "warning"
          : "none",
      analysis,
      analysisError,
      deployment,
      source: "vercel-cron",
    };

    // ── Log: supervisor report (action watched by the cron monitor) ───────
    await db.collection("agent_activity").insertOne({
      action: "supervisor_monitoring",
      agent: SUPERVISOR,
      result: report,
      success: true,
      createdAt: now,
      timestamp: now,
    });

    // ── Log: daily ops heartbeat (replaces the old 7AM Daily AI Operations
    //    laptop job -- this cron runs in the same 7AM CDT slot). ───────────
    await db.collection("agent_activity").insertOne({
      action: "daily_ops",
      agent: SUPERVISOR,
      type: "daily_ops",
      activity: `Daily ops: ${newProspectsToday} new prospects, ${outreachPending} pending outreach, ${newDriverLeads} new driver leads`,
      details: {
        prospects: newProspectsToday,
        outreachTasks: outreachPending,
        driverLeads: newDriverLeads,
        source: "vercel-cron",
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/supervisor-report] Fatal error:", error);

    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "supervisor_monitoring",
        agent: SUPERVISOR,
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
