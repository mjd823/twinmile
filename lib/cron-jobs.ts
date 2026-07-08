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
  },
  {
    id: "agent-reviews:ceo",
    name: "Alexandra Sterling — CEO Review (Mon)",
    agentName: "Alexandra Sterling",
    actions: ["ceo_strategic_review"],
    schedule: "0 16 * * * (Mondays, America/Chicago)",
    expectedEveryHours: 8 * 24 + 2,
    cadence: "weekly",
  },
];

/** Weekday name in America/Chicago -- weekly agents work Mondays only. */
export function chicagoWeekday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(date);
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
