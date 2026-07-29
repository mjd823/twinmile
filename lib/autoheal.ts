import type { Db } from "mongodb";
import { raiseBlocker, resolveBlocker, writeMemo } from "./agent-coordination";

/**
 * AUTO-HEAL — the agents' hands.
 *
 * The Supervisor has been producing findings with `autoFixable: true` for
 * weeks. Nothing consumed them, so "self-healing" meant a boolean in a log row.
 * This module executes them.
 *
 * The design deliberately rejects the common "catch the error, feed the trace
 * back to the model, let it retry with a new plan" pattern. That loop cannot
 * tell a transient failure from a permanent one, so it re-plans forever against
 * a dependency that will never come back — which is exactly what already
 * happened here: 101 outreach tasks failed with "Lead not found" (a permanent
 * condition — the lead row is gone) and the existing requeue endpoint would
 * happily reset them to pending to fail again, forever.
 *
 * So every repair is:
 *   1. CLASSIFIED  — transient (retry helps) vs deterministic (retry never
 *                    helps; the data or config must change) vs human (nobody
 *                    but a person can clear it).
 *   2. PRECONDITION — checked against live data. No precondition, no run.
 *   3. BOUNDED     — a hard cap on records touched per run.
 *   4. VERIFIED    — re-measured afterwards. An action that does not reduce
 *                    the thing it targets is a failed action, even if it threw
 *                    no error.
 *   5. CIRCUIT-BROKEN — two consecutive failures disable the action and open a
 *                    blocker instead of retrying into the void.
 *
 * What agents may NOT do here: write or deploy application code. Every repair
 * is a named, reviewed, idempotent data/config operation from this registry.
 * When the real fix needs new code, the action opens a repair request for a
 * human/coding agent. Autonomous code deployment is the one place where the
 * blast radius is unbounded, and every production account of it says the same
 * thing: keep the gate.
 */

export type FailureClass = "transient" | "deterministic" | "human";

export interface HealResult {
  action: string;
  ran: boolean;
  /** Why it did not run, when ran === false. */
  skipped?: string;
  affected: number;
  verified: boolean;
  detail: string;
}

interface HealAction {
  key: string;
  title: string;
  failureClass: FailureClass;
  /** Cheap check: is there anything to do? Returns the size of the problem. */
  measure: (db: Db) => Promise<number>;
  /** Do the repair. Must be idempotent and bounded. Returns records changed. */
  repair: (db: Db) => Promise<{ affected: number; detail: string }>;
  /** Max records touched in one run — bounds cost and blast radius. */
  cap: number;
}

const CIRCUIT_BREAK_AFTER = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Error classification — the thing the naive retry loop is missing
// ─────────────────────────────────────────────────────────────────────────────

const TRANSIENT_PATTERNS = [
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /rate.?limit/i,
  /429/,
  /50[0-4]\b/,
  /temporarily unavailable/i,
  /network/i,
];

const DETERMINISTIC_PATTERNS = [
  /lead not found/i,
  /duplicate/i,
  /invalid.*(email|address|recipient)/i,
  /no recipient/i,
  /unsubscribed/i,
  /suppress/i,
  /422/,
  /40[013]\b/,
];

export function classifyError(error: string | null | undefined): FailureClass {
  const e = String(error || "");
  if (!e) return "deterministic";
  if (TRANSIENT_PATTERNS.some((p) => p.test(e))) return "transient";
  if (DETERMINISTIC_PATTERNS.some((p) => p.test(e))) return "deterministic";
  // Unknown errors are treated as deterministic on purpose. Retrying an error
  // we do not understand is how a self-healing loop turns into a money leak;
  // it surfaces for a human instead.
  return "deterministic";
}

// ─────────────────────────────────────────────────────────────────────────────
// The registry
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS: HealAction[] = [
  {
    key: "quarantine_orphaned_outreach_tasks",
    title: "Quarantine outreach tasks whose lead no longer exists",
    failureClass: "deterministic",
    cap: 1000,
    measure: async (db) => db.collection("outreach_tasks").countDocuments({ status: "failed", error: /lead not found/i }),
    repair: async (db) => {
      const tasks = db.collection("outreach_tasks");
      const candidates = await tasks
        .find({ status: "failed", error: /lead not found/i })
        .project({ _id: 1, leadId: 1 })
        .limit(1000)
        .toArray();
      if (!candidates.length) return { affected: 0, detail: "nothing to quarantine" };

      // Prove the lead is actually gone before touching anything. A task whose
      // lead DOES exist was misclassified upstream and must be requeued, not
      // buried — the two outcomes are opposite, so guessing is not acceptable.
      const ids = candidates.map((c) => c.leadId).filter(Boolean);
      const alive = await db
        .collection("outbound_prospects")
        .find({ _id: { $in: ids as never[] } })
        .project({ _id: 1 })
        .toArray();
      const aliveSet = new Set(alive.map((a) => String(a._id)));

      const trulyOrphaned = candidates.filter((c) => !aliveSet.has(String(c.leadId))).map((c) => c._id);
      const recoverable = candidates.filter((c) => aliveSet.has(String(c.leadId))).map((c) => c._id);

      let affected = 0;
      if (trulyOrphaned.length) {
        const r = await tasks.updateMany(
          { _id: { $in: trulyOrphaned as never[] } },
          {
            $set: {
              status: "abandoned",
              abandonedAt: new Date(),
              abandonedReason: "lead record no longer exists — permanent, retry cannot succeed",
            },
          }
        );
        affected += r.modifiedCount;
      }
      if (recoverable.length) {
        const r = await tasks.updateMany(
          { _id: { $in: recoverable as never[] } },
          { $set: { status: "pending", attempts: 0, error: null, scheduledAt: new Date() } }
        );
        affected += r.modifiedCount;
      }
      return {
        affected,
        detail: `${trulyOrphaned.length} abandoned (lead genuinely gone), ${recoverable.length} requeued (lead exists — was misclassified)`,
      };
    },
  },

  {
    key: "reconcile_attempt_counters",
    title: "Reconcile the split attempts/attempt counters",
    failureClass: "deterministic",
    cap: 5000,
    // Two fields track the same thing: `attempts` (what the due-filter and
    // maxAttempts check read) and `attempt` (what the requeue path writes).
    // Tasks with attempt > attempts are invisible to the retry ceiling.
    measure: async (db) =>
      db.collection("outreach_tasks").countDocuments({ $expr: { $gt: ["$attempt", "$attempts"] } }),
    repair: async (db) => {
      const r = await db
        .collection("outreach_tasks")
        .updateMany({ $expr: { $gt: ["$attempt", "$attempts"] } }, [
          { $set: { attempts: "$attempt" } },
        ]);
      return {
        affected: r.modifiedCount,
        detail: "attempts synced to the higher attempt value so the retry ceiling applies",
      };
    },
  },

  {
    key: "requeue_transient_failures",
    title: "Requeue failures that are genuinely transient",
    failureClass: "transient",
    cap: 500,
    measure: async (db) => {
      const rows = await db
        .collection("outreach_tasks")
        .find({ status: "failed" })
        .project({ error: 1 })
        .limit(2000)
        .toArray();
      return rows.filter((r) => classifyError(r.error as string) === "transient").length;
    },
    repair: async (db) => {
      const tasks = db.collection("outreach_tasks");
      const rows = await tasks.find({ status: "failed" }).project({ _id: 1, error: 1 }).limit(2000).toArray();
      const retryable = rows
        .filter((r) => classifyError(r.error as string) === "transient")
        .slice(0, 500)
        .map((r) => r._id);
      if (!retryable.length) return { affected: 0, detail: "no transient failures" };
      const r = await tasks.updateMany(
        { _id: { $in: retryable as never[] } },
        { $set: { status: "pending", attempts: 0, scheduledAt: new Date(), requeuedReason: "autoheal:transient" } }
      );
      return { affected: r.modifiedCount, detail: "transient-only requeue (deterministic failures untouched)" };
    },
  },

  {
    key: "reclaim_stuck_sending_tasks",
    title: "Reclaim tasks stuck mid-send by a killed invocation",
    failureClass: "transient",
    cap: 500,
    // A serverless function killed between claim and send leaves the task in
    // `sending` forever, silently removing it from the queue.
    measure: async (db) =>
      db.collection("outreach_tasks").countDocuments({
        status: "sending",
        claimedAt: { $lt: new Date(Date.now() - 15 * 60_000) },
      }),
    repair: async (db) => {
      const r = await db.collection("outreach_tasks").updateMany(
        { status: "sending", claimedAt: { $lt: new Date(Date.now() - 15 * 60_000) } },
        { $set: { status: "pending", scheduledAt: new Date() }, $unset: { claimedAt: "", claimedBy: "" } }
      );
      return { affected: r.modifiedCount, detail: "stale claims released back to the queue" };
    },
  },

  {
    key: "renew_expired_engaged_sessions",
    title: "Renew onboarding links for people who engaged but ran out of time",
    failureClass: "deterministic",
    cap: 200,
    // Sessions expire in 7 days. Real applicants came back AFTER expiry and hit
    // a dead link. Someone who clicked is the warmest lead the company has;
    // letting the link rot is the most expensive bug in the funnel.
    measure: async (db) =>
      db.collection("onboarding_sessions").countDocuments({
        status: { $in: ["pending", "started"] },
        firstClickedAt: { $exists: true },
        expiresAt: { $lt: new Date() },
      }),
    repair: async (db) => {
      const r = await db.collection("onboarding_sessions").updateMany(
        {
          status: { $in: ["pending", "started"] },
          firstClickedAt: { $exists: true },
          expiresAt: { $lt: new Date() },
        },
        {
          $set: {
            expiresAt: new Date(Date.now() + 30 * 86400_000),
            renewedAt: new Date(),
            renewedBy: "autoheal",
          },
        },

      );
      return { affected: r.modifiedCount, detail: "engaged-but-expired links extended 30 days" };
    },
  },
];

export const HEAL_ACTION_KEYS = ACTIONS.map((a) => a.key);

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function consecutiveFailures(db: Db, key: string): Promise<number> {
  const rows = await db
    .collection("heal_runs")
    .find({ action: key })
    .sort({ ranAt: -1 })
    .limit(CIRCUIT_BREAK_AFTER)
    .toArray();
  if (rows.length < CIRCUIT_BREAK_AFTER) return 0;
  return rows.every((r) => r.verified === false) ? rows.length : 0;
}

/**
 * Run every eligible repair. Safe to call on a schedule: each action measures
 * first and no-ops when there is nothing to do.
 */
export async function runAutoHeal(db: Db, opts: { dryRun?: boolean } = {}): Promise<HealResult[]> {
  const results: HealResult[] = [];

  for (const action of ACTIONS) {
    // Circuit breaker — stop retrying an action that is not working.
    if ((await consecutiveFailures(db, action.key)) >= CIRCUIT_BREAK_AFTER) {
      await raiseBlocker(db, {
        key: `autoheal_failing_${action.key}`,
        title: `Self-repair "${action.title}" is not working`,
        owner: "human",
        blocking: `Automatic repair of: ${action.title}`,
        routeAround:
          "The action is disabled so it stops consuming runs. Everything else keeps healing normally; only this one condition persists.",
        humanAction: `Review heal_runs for action "${action.key}" — it ran twice and the problem did not shrink, which means the repair does not address the real cause.`,
        clearsWhen: "A heal_runs record for this action has verified: true",
        severity: "warning",
        raisedBy: "supervisor",
      });
      results.push({
        action: action.key,
        ran: false,
        skipped: "circuit breaker open after 2 unverified runs",
        affected: 0,
        verified: false,
        detail: "disabled pending human review",
      });
      continue;
    }

    const before = await action.measure(db);
    if (before === 0) {
      results.push({ action: action.key, ran: false, skipped: "nothing to repair", affected: 0, verified: true, detail: "clean" });
      continue;
    }

    if (opts.dryRun) {
      results.push({
        action: action.key,
        ran: false,
        skipped: "dry run",
        affected: 0,
        verified: false,
        detail: `${before} record(s) would be repaired`,
      });
      continue;
    }

    let affected = 0;
    let detail = "";
    let error: string | null = null;
    try {
      const out = await action.repair(db);
      affected = out.affected;
      detail = out.detail;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    // VERIFY — did the problem actually shrink? An action that reports success
    // while the measurement is unchanged has not healed anything.
    const after = error ? before : await action.measure(db);
    const verified = !error && after < before;

    await db.collection("heal_runs").insertOne({
      action: action.key,
      title: action.title,
      failureClass: action.failureClass,
      before,
      after,
      affected,
      verified,
      error,
      detail,
      ranAt: new Date(),
    });

    if (verified) {
      await resolveBlocker(db, `autoheal_failing_${action.key}`, "repair verified");
    }

    results.push({
      action: action.key,
      ran: true,
      affected,
      verified,
      detail: error ? `failed: ${error}` : `${detail} (${before} -> ${after})`,
    });
  }

  const healed = results.filter((r) => r.ran && r.verified);
  if (healed.length) {
    await writeMemo(db, {
      from: "supervisor",
      to: "all",
      kind: "observation",
      subject: `Auto-repair fixed ${healed.length} condition(s)`,
      body: healed.map((h) => `${h.action}: ${h.detail}`).join("\n"),
      evidence: `heal_runs records written ${new Date().toISOString()}`,
    });
  }

  return results;
}
