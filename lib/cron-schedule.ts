import type { CronJobDef } from "./cron-jobs";
import { chicagoWeekday } from "./cron-jobs";

/**
 * Expand the (UTC) cron expressions in lib/cron-jobs.ts into concrete
 * calendar occurrences so the admin calendar can plot the REAL work
 * schedule instead of a hardcoded synthetic one.
 *
 * Density rule: ONE occurrence per job per scheduled day, timed at the
 * day's first firing. Sub-daily frequency ("every 15 min", "5x/day") is
 * carried in `freqLabel` rather than flooding the grid with 96 chips.
 *
 * Weekly jobs (cadence "weekly") only occur on Mondays (America/Chicago),
 * matching how the agent-reviews cron gates them.
 */

export interface CronOccurrence {
  job: CronJobDef;
  /** UTC instant of the day's first firing (browsers render it local). */
  date: Date;
  /** Human frequency, e.g. "every 15 min, all day" or "5 runs, every 2h". */
  freqLabel: string;
}

interface ParsedCron {
  minute: number;
  firstHourUtc: number;
  freqLabel: string;
}

/**
 * Parse the minute + hour fields of the registry's cron strings. Handles the
 * shapes actually used there: "*\/15 * * * *", "0 14-23/2 * * *",
 * "0 13 * * *", and trailing annotations like "(Mondays, America/Chicago)".
 */
export function parseCronSchedule(
  schedule: string,
  cadence: CronJobDef["cadence"]
): ParsedCron {
  const [minField = "0", hourField = "*"] = schedule.trim().split(/\s+/);

  let minute = 0;
  let minuteEvery: number | null = null;
  if (minField.startsWith("*/")) {
    minuteEvery = parseInt(minField.slice(2), 10) || null;
  } else if (/^\d+$/.test(minField)) {
    minute = parseInt(minField, 10);
  }

  if (hourField === "*") {
    // All-day job. Anchor the daily marker at 13:00 UTC (8 AM Chicago in
    // summer) so it lands on the right Chicago calendar day.
    return {
      minute: 0,
      firstHourUtc: 13,
      freqLabel: minuteEvery ? `every ${minuteEvery} min, all day` : "hourly, all day",
    };
  }

  const m = hourField.match(/^(\d+)(?:-(\d+))?(?:\/(\d+))?$/);
  if (!m) {
    return { minute, firstHourUtc: 12, freqLabel: schedule };
  }
  const start = parseInt(m[1], 10);
  const end = m[2] ? parseInt(m[2], 10) : null;
  const step = m[3] ? parseInt(m[3], 10) : 1;

  if (end !== null) {
    let runs = 0;
    for (let h = start; h <= Math.min(end, 23); h += step) runs++;
    return {
      minute,
      firstHourUtc: start,
      freqLabel: `${runs} runs, every ${step}h`,
    };
  }
  return {
    minute,
    firstHourUtc: start,
    freqLabel: cadence === "weekly" ? "weekly, Mondays" : "once daily",
  };
}

/** All occurrences for the given jobs between `from` and `to` (inclusive). */
export function cronOccurrences(
  jobs: CronJobDef[],
  from: Date,
  to: Date
): CronOccurrence[] {
  const out: CronOccurrence[] = [];
  for (const job of jobs) {
    const parsed = parseCronSchedule(job.schedule, job.cadence);
    const cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
    );
    while (cursor <= to) {
      const occ = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          parsed.firstHourUtc,
          parsed.minute
        )
      );
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (occ < from || occ > to) continue;
      if (job.cadence === "weekly" && chicagoWeekday(occ) !== "Monday") continue;
      out.push({ job, date: occ, freqLabel: parsed.freqLabel });
    }
  }
  return out;
}
