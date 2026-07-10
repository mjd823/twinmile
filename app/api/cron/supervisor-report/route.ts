import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { CRON_JOBS, lastActivityFor } from "@/lib/cron-jobs";
import { getPipelineCounts, QUALIFIED_SCORE_THRESHOLD } from "@/lib/pipeline-stages";

/**
 * GET /api/cron/supervisor-report
 *
 * Vercel cron port of the laptop "AI Supervisor — Monitor" job (and
 * log-supervisor-report.js, which used to write a hand-built snapshot).
 * Unlike the legacy script, every number here is computed live from Mongo:
 *
 *   - pipeline counts (prospects -> qualified -> invited -> sessions)
 *   - outreach queue health (pending / sent today / failed)
 *   - cron health for every Vercel job in lib/cron-jobs.ts (stale detection)
 *   - per-agent activity summary (last seen + 24h task count)
 *   - deterministic bottleneck detection
 *
 * Writes the report to agent_activity as action "supervisor_monitoring"
 * (the action the admin cron monitor maps to the AI Supervisor row), plus a
 * small "daily_ops" heartbeat that replaces the old 7AM Daily AI Operations
 * job (this cron fires 12:00 UTC = 7AM CDT, same slot).
 *
 * NOTE: the old manual "supervisor auto-fix" script (supervisor_run.cjs,
 * commit c860187) was REMOVED — it wrote a mostly-hardcoded snapshot of this
 * same "supervisor_monitoring" action (fake cron statuses frozen at June 2026)
 * plus heuristic prospect scoring, and would clobber this route's live report
 * if re-run. Detect-and-fix for broken deploys/sites/crons is now handled by
 * the Mission Control hub watchdog (Projects/hub: lib/watchdog.ts), which
 * queues real Claude Code fix tasks; this route stays report-only.
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

    // ── Outreach queue ─────────────────────────────────────────────────────
    const [outreachPending, outreachSentToday, outreachFailed] = await Promise.all([
      db.collection("outreach_tasks").countDocuments({ status: { $in: ["pending", "retrying"] } }),
      db.collection("outreach_tasks").countDocuments({ status: "sent", sentAt: { $gte: dayAgo } }),
      db.collection("outreach_tasks").countDocuments({ status: "failed" }),
    ]);

    // ── Fleet ──────────────────────────────────────────────────────────────
    const trucksInFleet = await db.collection("trucks").countDocuments();

    // ── Cron health (every Vercel job) ─────────────────────────────────────
    const cronJobs = await Promise.all(
      CRON_JOBS.map(async (job) => {
        const last = await lastActivityFor(db, job.actions);
        const hoursSince = last.at
          ? (now.getTime() - last.at.getTime()) / 3600000
          : null;
        let status: "healthy" | "stale" | "error" | "never_ran";
        if (!last.at) status = "never_ran";
        else if (last.success === false) status = "error";
        else if (hoursSince !== null && hoursSince > job.expectedEveryHours) status = "stale";
        else status = "healthy";
        return {
          id: job.id,
          name: job.name,
          schedule: job.schedule,
          responsible: job.agentName,
          lastRun: last.at,
          hoursSinceLastRun: hoursSince === null ? null : Math.round(hoursSince * 10) / 10,
          status,
        };
      })
    );
    const cronHealth = {
      totalJobs: cronJobs.length,
      healthy: cronJobs.filter((j) => j.status === "healthy").length,
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

    // ── Bottleneck detection (deterministic) ───────────────────────────────
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
      const paused = process.env.OUTREACH_AUTOMATION !== "live";
      bottlenecks.push({
        severity: !paused && inviteJob && inviteJob.status !== "healthy" ? "critical" : "warning",
        description: `${awaitingInvite} qualified prospect(s) (status "qualified", aiScore >= ${QUALIFIED_SCORE_THRESHOLD}) awaiting onboarding invites${paused ? " — outreach automation is PAUSED, so this is expected until it goes live" : `. Invite cron status: ${inviteJob?.status ?? "unknown"}.`}`,
      });
    }
    if (trucksInFleet === 0 && (onboardingInvited > 0 || sessionsCompleted > 0)) {
      bottlenecks.push({
        severity: "critical",
        description: `0 trucks in fleet while the onboarding pipeline is active (${onboardingInvited} invited, ${sessionsCompleted} completed). Cannot dispatch drivers without trucks.`,
      });
    }
    if (outreachFailed > 0) {
      bottlenecks.push({
        severity: "warning",
        description: `${outreachFailed} outreach task(s) in failed state.`,
      });
    }
    if (outreachPending > 50) {
      bottlenecks.push({
        severity: "warning",
        description: `Outreach backlog: ${outreachPending} pending/retrying tasks.`,
      });
    }
    for (const job of cronJobs) {
      if (job.status === "stale" || job.status === "error") {
        bottlenecks.push({
          severity: "critical",
          description: `Cron "${job.name}" is ${job.status} (last run: ${job.lastRun ? job.lastRun.toISOString() : "never"}).`,
        });
      }
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
