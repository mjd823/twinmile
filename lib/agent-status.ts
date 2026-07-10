import {
  CRON_JOBS,
  chicagoWeekday,
  classifyCronJob,
  lastActivityFor,
} from "@/lib/cron-jobs";

/**
 * Shared "who's clocked in" computation for the Vercel cron jobs registered
 * in lib/cron-jobs.ts. Used by BOTH:
 *   - GET /api/admin/agent-status  (CRON_SECRET-gated JSON for the hub)
 *   - server-rendered admin pages  (/admin/supervisor, /admin/calendar)
 * so the admin UI never has to call its own API with the cron secret.
 *
 * Status semantics come from classifyCronJob (ONE shared classification):
 *   on_time   — ran inside its freshness window / most recent weekly slot
 *   scheduled — waiting for a slot that hasn't happened yet (NOT unhealthy;
 *               e.g. a Monday-only job ported to Vercel mid-week)
 *   late      — genuinely missed its schedule
 *   error     — last run reported a failure
 *   never_ran — never logged a run despite its slot having passed
 */

export type JobStatus = "on_time" | "scheduled" | "late" | "error" | "never_ran";

export interface JobStatusRow {
  id: string;
  name: string;
  agent: string;
  schedule: string;
  cadence: "daily" | "weekly" | "sub-daily";
  expectedEveryHours: number;
  /** ISO timestamp of the newest matching agent_activity row, or null */
  lastRun: string | null;
  hoursSinceLastRun: number | null;
  onTime: boolean;
  lastSuccess: boolean | null;
  status: JobStatus;
  /** Plain-English explanation of the status (from classifyCronJob). */
  reason: string;
  lastResult: unknown;
}

export interface JobStatusSummary {
  totalJobs: number;
  onTime: number;
  scheduled: number;
  late: number;
  error: number;
  neverRan: number;
  allClockedIn: boolean;
}

export interface JobStatusReport {
  generatedAt: string;
  chicagoWeekday: string;
  summary: JobStatusSummary;
  jobs: JobStatusRow[];
}

const HEALTH_TO_JOB_STATUS: Record<string, JobStatus> = {
  healthy: "on_time",
  scheduled: "scheduled",
  stale: "late",
  error: "error",
  never_ran: "never_ran",
};

/**
 * Compute the live timesheet for every registered cron job.
 * `db` is a connected mongodb Db (same loose typing as lastActivityFor).
 */
export async function computeJobStatuses(
  db: any,
  now: Date = new Date()
): Promise<JobStatusReport> {
  const jobs: JobStatusRow[] = await Promise.all(
    CRON_JOBS.map(async (job) => {
      const last = await lastActivityFor(db, job.actions);
      const hoursSince = last.at
        ? (now.getTime() - last.at.getTime()) / 3600000
        : null;
      const cls = classifyCronJob(job, { at: last.at, success: last.success }, now);
      const status = HEALTH_TO_JOB_STATUS[cls.status] ?? "never_ran";
      return {
        id: job.id,
        name: job.name,
        agent: job.agentName,
        schedule: job.schedule,
        cadence: job.cadence,
        expectedEveryHours: job.expectedEveryHours,
        lastRun: last.at ? last.at.toISOString() : null,
        hoursSinceLastRun:
          hoursSince === null ? null : Math.round(hoursSince * 10) / 10,
        onTime: status === "on_time",
        lastSuccess: last.success,
        status,
        reason: cls.reason,
        lastResult: last.result,
      };
    })
  );

  const summary: JobStatusSummary = {
    totalJobs: jobs.length,
    onTime: jobs.filter((j) => j.status === "on_time").length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    late: jobs.filter((j) => j.status === "late").length,
    error: jobs.filter((j) => j.status === "error").length,
    neverRan: jobs.filter((j) => j.status === "never_ran").length,
    // "scheduled" counts as clocked in — the job is waiting for its slot,
    // not missing one.
    allClockedIn: jobs.every(
      (j) => j.status === "on_time" || j.status === "scheduled"
    ),
  };

  return {
    generatedAt: now.toISOString(),
    chicagoWeekday: chicagoWeekday(now),
    summary,
    jobs,
  };
}
