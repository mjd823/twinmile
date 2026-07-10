/**
 * Registry of the Vercel-hosted scheduled jobs (the old laptop "Hermes" jobs
 * that were worth keeping). Shared by:
 *   - /api/cron/supervisor-report  (cron health section of the daily report)
 *   - /api/admin/agent-status      (the "who's clocked in" timesheet)
 *
 * `actions` are the agent_activity action names each job logs -- the same
 * names /api/admin/cron-monitor watches, so the existing dashboard keeps
 * working unchanged.
 *
 * `expectedEveryHours` is the freshness window: if the newest matching
 * agent_activity record is older than this, the job is considered stale.
 * Windows are deliberately generous (schedule interval + slack) so a single
 * slow run doesn't page anyone.
 */

export interface CronJobDef {
  id: string;
  name: string;
  agentName: string;
  /** agent_activity action names this job logs (any match counts as a run) */
  actions: string[];
  /** vercel.json cron expression (UTC) -- informational */
  schedule: string;
  /** stale if no matching activity within this many hours */
  expectedEveryHours: number;
  /** "daily" | "weekly" -- weekly jobs only log on Mondays (America/Chicago) */
  cadence: "daily" | "weekly" | "sub-daily";
  /**
   * ISO date the Vercel cron was first deployed. Used so a weekly job ported
   * mid-week is reported "scheduled — first run next Monday" instead of the
   * false alarms "never ran"/"stale" (the exact bug that made the July 2026
   * report cry wolf about the Monday-only marketing + CEO reviews).
   */
  deployedAt?: string;
}

export const CRON_JOBS: CronJobDef[] = [
  {
    id: "process-outreach",
    name: "Process Outreach Tasks",
    agentName: "Outreach Processor",
    actions: ["outreach_cron_summary", "outreach_processing"],
    schedule: "*/15 * * * *",
    expectedEveryHours: 1,
    cadence: "sub-daily",
  },
  {
    id: "onboarding-invites",
    name: "Auto Onboarding Invitations",
    agentName: "Auto Onboarding Processor",
    actions: ["auto_onboarding_invite"],
    schedule: "0 14-23/2 * * *",
    // Runs 14:00-22:00 UTC every 2h; the overnight gap is 16h.
    expectedEveryHours: 18,
    cadence: "sub-daily",
  },
  {
    id: "prospecting",
    name: "Sofia — FMCSA Prospecting",
    agentName: "Sofia Rodriguez",
    actions: ["fmcsa_prospecting"],
    schedule: "0 13 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "prospect-priorities",
    name: "Sofia — New-Authority & Insurance-Lapse Priorities",
    agentName: "Sofia Rodriguez",
    actions: ["prospect_priorities"],
    schedule: "0 9 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "call-sheet",
    name: "Sofia — Daily Call Sheet (phone-only prospects)",
    agentName: "Sofia Rodriguez",
    actions: ["call_sheet"],
    schedule: "30 13 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "social-listener",
    name: "Sofia — Social Listener (Reddit, read-only)",
    agentName: "Sofia Rodriguez",
    actions: ["social_listening"],
    schedule: "15 */6 * * *",
    expectedEveryHours: 13,
    cadence: "sub-daily",
  },
  {
    id: "supervisor-report",
    name: "AI Supervisor — Daily Report",
    agentName: "AI Supervisor",
    actions: ["supervisor_monitoring"],
    schedule: "0 12 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "agent-reviews:sales",
    name: "Marcus Chen — Sales Review",
    agentName: "Marcus Chen",
    actions: ["daily_sales_review"],
    schedule: "0 16 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "agent-reviews:ops",
    name: "David Kumar — Ops Check",
    agentName: "David Kumar",
    actions: ["daily_ops_check"],
    schedule: "0 16 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "agent-reviews:hr",
    name: "Jennifer Foster — HR Review",
    agentName: "Jennifer Foster",
    actions: ["hr_onboarding_review"],
    schedule: "0 16 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "agent-reviews:finance",
    name: "Robert Chang — Finance Review",
    agentName: "Robert Chang",
    actions: ["daily_finance_review"],
    schedule: "0 16 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "agent-reviews:customer-success",
    name: "Emily Watson — Customer Success",
    agentName: "Emily Watson",
    actions: ["customer_success_check"],
    schedule: "0 16 * * *",
    expectedEveryHours: 26,
    cadence: "daily",
  },
  {
    id: "agent-reviews:marketing",
    name: "Isabella Martinez — Marketing (Mon)",
    agentName: "Isabella Martinez",
    actions: ["marketing_analysis"],
    schedule: "0 16 * * * (Mondays, America/Chicago)",
    expectedEveryHours: 8 * 24 + 2,
    cadence: "weekly",
    // Ported from the laptop system on Mon Jul 7 2026 — one day AFTER that
    // week's Monday slot, so its first Vercel run is the following Monday.
    deployedAt: "2026-07-07T00:00:00Z",
  },
  {
    id: "agent-reviews:ceo",
    name: "Alexandra Sterling — CEO Review (Mon)",
    agentName: "Alexandra Sterling",
    actions: ["ceo_strategic_review"],
    schedule: "0 16 * * * (Mondays, America/Chicago)",
    expectedEveryHours: 8 * 24 + 2,
    cadence: "weekly",
    deployedAt: "2026-07-07T00:00:00Z",
  },
];

/** Weekday name in America/Chicago -- weekly agents work Mondays only. */
export function chicagoWeekday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(date);
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE cron-health classification — shared by the supervisor report, the agent
// timesheet, and the cron monitor, so every surface tells the same truth.
// ─────────────────────────────────────────────────────────────────────────────

export type CronHealthStatus =
  | "healthy"
  | "scheduled" // waiting for a slot that hasn't happened yet — NOT unhealthy
  | "stale"
  | "error"
  | "never_ran";

export interface CronClassification {
  status: CronHealthStatus;
  /** Plain-English one-liner explaining WHY — shown in the UI, fed to the LLM. */
  reason: string;
  /** Next expected run (weekly jobs), informational. */
  nextExpectedRun: Date | null;
}

/** Weekly agent-review jobs fire in the 16:00 UTC slot, Mondays only. */
const WEEKLY_SLOT_UTC_HOUR = 16;
/** How long after a due slot we wait before calling a weekly job stale. */
const WEEKLY_GRACE_MS = 2 * 60 * 60 * 1000;

function mondaySlotOnOrBefore(now: Date): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), WEEKLY_SLOT_UTC_HOUR, 0, 0)
  );
  while (d.getUTCDay() !== 1 || d.getTime() > now.getTime()) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

function mondaySlotAfter(now: Date): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), WEEKLY_SLOT_UTC_HOUR, 0, 0)
  );
  while (d.getUTCDay() !== 1 || d.getTime() <= now.getTime()) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function fmtDayCT(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Classify one job from its latest logged run. Truthful by design:
 *  - a weekly job whose Vercel port hasn't reached its first Monday slot is
 *    "scheduled" (waiting), never "never_ran"/"stale";
 *  - "stale"/"never_ran" are reserved for jobs that genuinely missed a slot.
 */
export function classifyCronJob(
  job: CronJobDef,
  last: { at: Date | null; success: boolean | null },
  now: Date = new Date()
): CronClassification {
  if (last.at && last.success === false) {
    return {
      status: "error",
      reason: `Last run (${fmtDayCT(last.at)}) reported a failure — check its logs.`,
      nextExpectedRun: null,
    };
  }

  const deployed = job.deployedAt ? new Date(job.deployedAt) : null;

  if (job.cadence === "weekly") {
    const lastDue = mondaySlotOnOrBefore(now);
    const nextDue = mondaySlotAfter(now);

    // The Vercel cron was deployed AFTER the most recent Monday slot — it has
    // never had a chance to run. Waiting, not broken.
    if (deployed && lastDue.getTime() < deployed.getTime()) {
      return {
        status: "scheduled",
        reason: `Runs Mondays only. Ported to Vercel ${fmtDayCT(deployed)} — first run is ${fmtDayCT(nextDue)}.`,
        nextExpectedRun: nextDue,
      };
    }
    if (last.at && last.at.getTime() >= lastDue.getTime()) {
      return {
        status: "healthy",
        reason: `Ran in its most recent Monday slot (${fmtDayCT(last.at)}). Next: ${fmtDayCT(nextDue)}.`,
        nextExpectedRun: nextDue,
      };
    }
    // Slot just opened — give the run a grace window before alarming.
    if (now.getTime() - lastDue.getTime() < WEEKLY_GRACE_MS) {
      return {
        status: "scheduled",
        reason: `Monday slot in progress — expecting a run shortly.`,
        nextExpectedRun: lastDue,
      };
    }
    if (!last.at) {
      return {
        status: "never_ran",
        reason: `Never logged a run and missed the ${fmtDayCT(lastDue)} Monday slot.`,
        nextExpectedRun: nextDue,
      };
    }
    return {
      status: "stale",
      reason: `Missed the ${fmtDayCT(lastDue)} Monday slot — last ran ${fmtDayCT(last.at)}.`,
      nextExpectedRun: nextDue,
    };
  }

  // Daily / sub-daily jobs: freshness window.
  if (!last.at) {
    if (deployed && now.getTime() - deployed.getTime() < job.expectedEveryHours * 3600000) {
      return {
        status: "scheduled",
        reason: `Just deployed — first run expected within ${job.expectedEveryHours}h.`,
        nextExpectedRun: null,
      };
    }
    return {
      status: "never_ran",
      reason: "Never logged a run despite its schedule having passed.",
      nextExpectedRun: null,
    };
  }
  const hoursSince = (now.getTime() - last.at.getTime()) / 3600000;
  if (hoursSince <= job.expectedEveryHours) {
    return {
      status: "healthy",
      reason: `Ran ${hoursSince < 1 ? `${Math.max(1, Math.round(hoursSince * 60))}m` : `${Math.round(hoursSince)}h`} ago (expected at least every ${job.expectedEveryHours}h).`,
      nextExpectedRun: null,
    };
  }
  return {
    status: "stale",
    reason: `Genuinely missed its schedule — last ran ${Math.round(hoursSince)}h ago, expected at least every ${job.expectedEveryHours}h.`,
    nextExpectedRun: null,
  };
}

/**
 * Newest agent_activity timestamp for a set of actions.
 * Rows use createdAt, legacy rows use timestamp -- accept either.
 */
export async function lastActivityFor(db: any, actions: string[]): Promise<{ at: Date | null; success: boolean | null; result: unknown }> {
  const rows = await db
    .collection("agent_activity")
    .find({ action: { $in: actions } })
    .sort({ createdAt: -1, timestamp: -1 })
    .limit(1)
    .toArray();
  const last: any = rows[0];
  if (!last) return { at: null, success: null, result: null };
  const at = last.createdAt || last.timestamp || null;
  return {
    at: at ? new Date(at) : null,
    success: last.success !== false,
    result: last.result || last.details || null,
  };
}
