import { CRON_JOBS, chicagoWeekday, lastActivityFor } from "@/lib/cron-jobs";

/**
 * Shared "who's clocked in" computation for the Vercel cron jobs registered
 * in lib/cron-jobs.ts. Used by BOTH:
 *   - GET /api/admin/agent-status  (CRON_SECRET-gated JSON for the hub)
 *   - server-rendered admin pages  (/admin/supervisor, /admin/calendar)
 * so the admin UI never has to call its own API with the cron secret.
 */

export type JobStatus = "on_time" | "late" | "error" | "never_ran";

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
  lastResult: unknown;
}

export interface JobStatusSummary {
  totalJobs: number;
  onTime: number;
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
      const onTime =
        hoursSince !== null &&
        hoursSince <= job.expectedEveryHours &&
        last.success !== false;
      let status: JobStatus;
      if (!last.at) status = "never_ran";
      else if (last.success === false) status = "error";
      else if (!onTime) status = "late";
      else status = "on_time";
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
        onTime,
        lastSuccess: last.success,
        status,
        lastResult: last.result,
      };
    })
  );

  const summary: JobStatusSummary = {
    totalJobs: jobs.length,
    onTime: jobs.filter((j) => j.status === "on_time").length,
    late: jobs.filter((j) => j.status === "late").length,
    error: jobs.filter((j) => j.status === "error").length,
    neverRan: jobs.filter((j) => j.status === "never_ran").length,
    allClockedIn: jobs.every((j) => j.status === "on_time"),
  };

  return {
    generatedAt: now.toISOString(),
    chicagoWeekday: chicagoWeekday(now),
    summary,
    jobs,
  };
}
