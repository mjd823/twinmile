import type { Db } from "mongodb";
import { getPipelineCounts, type PipelineCounts } from "./pipeline-stages";
import { openBlockers, type Blocker } from "./agent-coordination";
import { COMPANY_GOAL } from "./agent-charters";

/**
 * THE OPERATING PICTURE — one function, one shared truth.
 *
 * Every agent used to run its own counts. Seven agents each issued their own
 * countDocuments calls, so "how many completed onboarding" had several
 * independent definitions and nobody noticed they disagreed. Worse, no agent
 * could see anything outside its own department, so a problem that spanned two
 * of them was invisible to both.
 *
 * getOperatingPicture() is computed ONCE per cron run and handed to every
 * agent. Same numbers, same definitions, same blind spots — so when two agents
 * disagree it is a disagreement about judgment, not about arithmetic.
 *
 * Everything here is measured, never estimated. If a number cannot be computed
 * it is null, not zero — the distinction between "none" and "unknown" is what
 * let this company report 0 completions for a month without anyone asking
 * whether completions were even being recorded. (They were not.)
 */

export interface OutreachHealth {
  sentLast24h: number;
  sentLast7d: number;
  totalSent: number;
  pending: number;
  retrying: number;
  failed: number;
  /** Failure reasons grouped — the input to deciding transient vs deterministic. */
  failuresByReason: { reason: string; count: number }[];
  /** Tasks pointing at a lead row that no longer exists. Pure data corruption. */
  orphanedTasks: number;
  repliesReceived: number;
  /** Null when never measured, e.g. no webhook data yet. */
  bounceRate: number | null;
  complaintRate: number | null;
  automationMode: string;
  sendingIdentity: { from: string; replyTo: string };
  dailyCap: number;
}

export interface OnboardingHealth {
  totalSessions: number;
  everClicked: number;
  completed: number;
  /** Where people stop. The single most valuable diagnostic in the business. */
  dropOffByStep: { step: number; reached: number; stalled: number }[];
  expiredUnfinished: number;
  /** True when the app has no code path that marks a session complete. */
  completionRecordingBroken: boolean;
  activeDrivers: number;
  /**
   * Applicants who finished but could not supply something on the day (lease
   * unsigned, MC number not to hand, a document still coming). These are the
   * highest-value calls in the business — a person who applied and is waiting
   * on one item, not a cold prospect.
   */
  awaitingSignature: number;
  needingFollowUp: number;
  followUpItems: { item: string; count: number }[];
}

export interface AgentHealth {
  action: string;
  agent: string;
  lastRunAt: string | null;
  hoursSinceLastRun: number | null;
  lastSuccess: boolean | null;
  runsLast24h: number;
}

export interface OperatingPicture {
  generatedAt: string;
  goal: {
    objective: string;
    primaryMetric: string;
    target: number;
    current: number;
    /** Days since the primary metric last moved. Null if it has never moved. */
    daysSinceProgress: number | null;
  };
  pipeline: PipelineCounts;
  outreach: OutreachHealth;
  onboarding: OnboardingHealth;
  fleet: { trucks: number; loads: number; delivered: number; customers: number };
  agents: AgentHealth[];
  blockers: Blocker[];
  /** Set when a number could not be computed — agents must not treat it as 0. */
  unavailable: string[];
}

const AGENT_ACTIONS: { action: string; agent: string }[] = [
  { action: "fmcsa_prospecting", agent: "Sofia Rodriguez" },
  { action: "prospect_priorities", agent: "Sofia Rodriguez" },
  { action: "call_sheet", agent: "Sofia Rodriguez" },
  { action: "social_listening", agent: "Sofia Rodriguez" },
  { action: "daily_sales_review", agent: "Marcus Chen" },
  { action: "hr_onboarding_review", agent: "Jennifer Foster" },
  { action: "daily_ops_check", agent: "David Kumar" },
  { action: "daily_finance_review", agent: "Robert Chang" },
  { action: "customer_success_check", agent: "Emily Watson" },
  { action: "marketing_analysis", agent: "Isabella Martinez" },
  { action: "ceo_strategic_review", agent: "Alexandra Sterling" },
  { action: "supervisor_monitoring", agent: "AI Supervisor" },
  { action: "outreach_cron_summary", agent: "Outreach Processor" },
  { action: "auto_onboarding_invite", agent: "Auto Onboarding Processor" },
];

/** Onboarding wizard steps, mirrored from components/onboarding/OnboardingPortal.tsx. */
export const ONBOARDING_STEPS = [
  { step: 1, name: "Identity" },
  { step: 2, name: "FMCSA authority" },
  { step: 3, name: "Background consent" },
  { step: 4, name: "E-signature" },
  { step: 5, name: "Documents (6 required)" },
  { step: 6, name: "Insurance" },
  { step: 7, name: "Account created" },
];

async function outreachHealth(db: Db): Promise<OutreachHealth> {
  const now = Date.now();
  const day = new Date(now - 86400_000);
  const week = new Date(now - 7 * 86400_000);
  const tasks = db.collection("outreach_tasks");

  const [
    sentLast24h,
    sentLast7d,
    totalSent,
    pending,
    retrying,
    failed,
    failureRows,
    repliesReceived,
  ] = await Promise.all([
    tasks.countDocuments({ status: "sent", sentAt: { $gte: day } }),
    tasks.countDocuments({ status: "sent", sentAt: { $gte: week } }),
    tasks.countDocuments({ status: "sent" }),
    tasks.countDocuments({ status: "pending" }),
    tasks.countDocuments({ status: "retrying" }),
    tasks.countDocuments({ status: "failed" }),
    tasks
      .aggregate([
        { $match: { status: "failed" } },
        { $group: { _id: { $ifNull: ["$error", "(none recorded)"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
    db.collection("outbound_prospects").countDocuments({ status: "replied" }),
  ]);

  // Orphan detection: a failed task whose lead genuinely no longer exists.
  // Counted rather than assumed — "Lead not found" in the error string is the
  // symptom; the lookup is the proof.
  const orphanCandidates = await tasks
    .find({ status: "failed", error: /lead not found/i })
    .project({ leadId: 1 })
    .limit(500)
    .toArray();
  let orphanedTasks = 0;
  if (orphanCandidates.length) {
    const ids = orphanCandidates.map((t) => t.leadId).filter(Boolean);
    const alive = await db
      .collection("outbound_prospects")
      .find({ _id: { $in: ids as never[] } })
      .project({ _id: 1 })
      .toArray();
    const aliveSet = new Set(alive.map((a) => String(a._id)));
    orphanedTasks = orphanCandidates.filter((t) => !aliveSet.has(String(t.leadId))).length;
  }

  return {
    sentLast24h,
    sentLast7d,
    totalSent,
    pending,
    retrying,
    failed,
    failuresByReason: failureRows.map((r) => ({
      reason: String(r._id).slice(0, 200),
      count: r.count as number,
    })),
    orphanedTasks,
    repliesReceived,
    // Not yet derivable: the Resend webhook records events but bounce/complaint
    // rates have never been aggregated. null, never 0 — see module header.
    bounceRate: null,
    complaintRate: null,
    automationMode: process.env.OUTREACH_AUTOMATION || "unset",
    sendingIdentity: {
      from: process.env.RESEND_FROM_EMAIL || "(unset)",
      replyTo: process.env.OUTREACH_REPLY_TO || process.env.RESEND_NOTIFY_TO || "(unset)",
    },
    dailyCap: Number(process.env.OUTREACH_DAILY_CAP || 100),
  };
}

async function onboardingHealth(db: Db): Promise<OnboardingHealth> {
  const sessions = db.collection("onboarding_sessions");
  const [
    totalSessions,
    everClicked,
    completed,
    expiredUnfinished,
    activeDrivers,
    stepRows,
    awaitingSignature,
    needingFollowUp,
    followUpRows,
  ] = await Promise.all([
      sessions.countDocuments({}),
      sessions.countDocuments({ firstClickedAt: { $exists: true } }),
      sessions.countDocuments({ status: "completed" }),
      sessions.countDocuments({
        status: { $ne: "completed" },
        expiresAt: { $lt: new Date() },
      }),
      db.collection("users").countDocuments({ role: "driver" }),
    sessions
      .aggregate([
        { $match: { currentStep: { $gte: 1 } } },
        { $group: { _id: "$currentStep", count: { $sum: 1 } } },
      ])
      .toArray(),
    db.collection("lease_agreements").countDocuments({ status: "awaiting_signature" }),
    db.collection("users").countDocuments({ role: "driver", followUpNeeded: true }),
    // What people are actually waiting on, so the follow-up is a specific ask
    // ("we need your COI") rather than a vague check-in.
    db
      .collection("users")
      .aggregate([
        { $match: { role: "driver", followUpNeeded: true } },
        {
          $project: {
            items: {
              $concatArrays: [
                { $ifNull: ["$outstandingDocuments", []] },
                { $map: { input: { $objectToArray: { $ifNull: ["$deferredItems", {}] } }, as: "d", in: "$$d.v" } },
              ],
            },
          },
        },
        { $unwind: "$items" },
        { $group: { _id: "$items", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
  ]);

  const stalledByStep = new Map<number, number>();
  for (const r of stepRows) stalledByStep.set(Number(r._id), r.count as number);

  const dropOffByStep = ONBOARDING_STEPS.map(({ step }) => {
    let reached = 0;
    for (const [s, c] of stalledByStep) if (s >= step) reached += c;
    return { step, reached, stalled: stalledByStep.get(step) || 0 };
  });

  return {
    totalSessions,
    everClicked,
    completed,
    dropOffByStep,
    expiredUnfinished,
    // Detected, not hardcoded: if anyone ever clicked through but nothing is
    // marked complete AND no lease exists, completion recording is suspect.
    completionRecordingBroken:
      completed === 0 && (await db.collection("lease_agreements").countDocuments()) === 0 && everClicked > 0,
    activeDrivers,
    awaitingSignature,
    needingFollowUp,
    followUpItems: followUpRows.map((r) => ({ item: String(r._id), count: r.count as number })),
  };
}

async function agentHealth(db: Db): Promise<AgentHealth[]> {
  const day = new Date(Date.now() - 86400_000);
  return Promise.all(
    AGENT_ACTIONS.map(async ({ action, agent }) => {
      const [last, runsLast24h] = await Promise.all([
        db.collection("agent_activity").findOne({ action }, { sort: { timestamp: -1 } }),
        db.collection("agent_activity").countDocuments({ action, timestamp: { $gte: day } }),
      ]);
      const ts = last?.timestamp instanceof Date ? last.timestamp : null;
      return {
        action,
        agent,
        lastRunAt: ts ? ts.toISOString() : null,
        hoursSinceLastRun: ts ? Math.round((Date.now() - ts.getTime()) / 3600_000) : null,
        lastSuccess: last ? last.success !== false : null,
        runsLast24h,
      };
    })
  );
}

export async function getOperatingPicture(db: Db): Promise<OperatingPicture> {
  const unavailable: string[] = [];

  const [pipeline, outreach, onboarding, agents, blockers, trucks, loads, delivered, customers] =
    await Promise.all([
      getPipelineCounts(db),
      outreachHealth(db),
      onboardingHealth(db),
      agentHealth(db),
      openBlockers(db),
      db.collection("trucks").countDocuments(),
      db.collection("loads").countDocuments(),
      db.collection("loads").countDocuments({ status: "delivered" }),
      db.collection("customers").countDocuments({ status: { $ne: "archived" } }),
    ]);

  if (outreach.bounceRate === null) unavailable.push("outreach.bounceRate (webhook events never aggregated)");
  if (outreach.complaintRate === null) unavailable.push("outreach.complaintRate (webhook events never aggregated)");

  // Days since the primary metric moved. No driver has ever been created, so
  // this is null rather than a misleading large number.
  const firstDriver = await db
    .collection("users")
    .findOne({ role: "driver" }, { sort: { createdAt: -1 } });
  const daysSinceProgress =
    firstDriver?.createdAt instanceof Date
      ? Math.floor((Date.now() - firstDriver.createdAt.getTime()) / 86400_000)
      : null;

  return {
    generatedAt: new Date().toISOString(),
    goal: {
      objective: COMPANY_GOAL.objective,
      primaryMetric: COMPANY_GOAL.primaryMetric,
      target: COMPANY_GOAL.target,
      current: onboarding.activeDrivers,
      daysSinceProgress,
    },
    pipeline,
    outreach,
    onboarding,
    fleet: { trucks, loads, delivered, customers },
    agents,
    blockers,
    unavailable,
  };
}
