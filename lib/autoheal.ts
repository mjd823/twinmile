import type { Db } from "mongodb";
import { raiseBlocker, resolveBlocker, writeMemo } from "./agent-coordination";
import { resolveLead } from "./outreach-lead-resolver";
import { notifyStalledOnboarding, sendOnboardingResumeNudge } from "./email";
import { getOnboardingUrl } from "./site-config";

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
 * One action (follow_up_stalled_onboarding) also SENDS MAIL, which is the only
 * outbound side effect in this registry. It is allowed because the alternative is
 * a repair that fixes the data and still lets the person it is about go
 * uncontacted — which is how a step-4 applicant sat for 37 days behind a link
 * this module had already renewed for him. It is made safe the same way every
 * other action is: a stamp on the record (followUpSentAt) so it fires once, a
 * hard cap per run, and a measurement that shrinks only when rows actually leave
 * the selector.
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
        .project({ _id: 1, leadId: 1, leadEmail: 1, leadType: 1, leadCollection: 1 })
        .limit(1000)
        .toArray();
      if (!candidates.length) return { affected: 0, detail: "nothing to quarantine" };

      // Prove the lead is actually gone before touching anything, using the
      // SENDER's resolver (lib/outreach-lead-resolver.ts) rather than a local
      // _id-only probe. The old probe matched _id against outbound_prospects
      // only; the sender also falls back to leadEmail. That gap is why 59
      // reachable prospects were written off as "lead record no longer
      // exists — permanent" while the sender finds every one of them by email.
      // A task whose lead DOES exist was misclassified upstream and must be
      // requeued, not buried — the two outcomes are opposite, so guessing is
      // not acceptable.
      const trulyOrphaned: unknown[] = [];
      const recoverable: unknown[] = [];
      for (const c of candidates) {
        const lead = await resolveLead(db, c);
        (lead ? recoverable : trulyOrphaned).push(c._id);
      }

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
          {
            $set: { status: "pending", attempts: 0, error: null, scheduledAt: new Date() },
            // RETIRE the duplicate counter, do not just zero `attempts`.
            // reconcile_attempt_counters is the very next action in this same
            // loop and copies `attempt` -> `attempts` whenever attempt is
            // higher — so a requeue that left attempt=2 behind had its reset
            // undone ~150ms later, parking every task one attempt from
            // permanent death. Unsetting makes the two actions unable to fight.
            $unset: { attempt: "" },
          }
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
    // maxAttempts check read) and `attempt` (a fossil the retired laptop script
    // wrote). Tasks with attempt > attempts are invisible to the retry ceiling.
    //
    // pending/sending are EXCLUDED on purpose: a task freshly requeued by
    // quarantine_orphaned_outreach_tasks / requeue_transient_failures is
    // deliberately back at attempts:0, and this action running immediately
    // afterwards in the same loop used to shove it straight back up.
    measure: async (db) =>
      db.collection("outreach_tasks").countDocuments({
        status: { $nin: ["pending", "sending"] },
        $expr: { $gt: ["$attempt", "$attempts"] },
      }),
    repair: async (db) => {
      const r = await db
        .collection("outreach_tasks")
        .updateMany(
          { status: { $nin: ["pending", "sending"] }, $expr: { $gt: ["$attempt", "$attempts"] } },
          [{ $set: { attempts: "$attempt" } }]
        );
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
        {
          $set: { status: "pending", attempts: 0, scheduledAt: new Date(), requeuedReason: "autoheal:transient" },
          // Same reason as the quarantine action: zeroing `attempts` while
          // leaving `attempt` behind gets reverted by reconcile_attempt_counters.
          $unset: { attempt: "" },
        }
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

  {
    key: "follow_up_stalled_onboarding",
    title: "Email + escalate applicants who stopped mid-application",
    failureClass: "deterministic",
    cap: 25,
    /*
     * THE OTHER HALF OF THE FUNNEL LEAK.
     *
     * notifyOnboardingComplete only fires on SUBMISSION. Someone who quits at the
     * signature step never submits, so he produces no deferredItems record, no
     * completion alert, and no email — he is invisible to every alert this system
     * has. A real applicant sat at step 4 for 37 days having already entered his
     * DOB, SSN last-4, address, truck VIN and USDOT number, and nothing ever
     * contacted him. His link was even renewed by the action above, so it still
     * worked; nobody told him.
     *
     * Selector: got past the first couple of screens (currentStep >= 3), has been
     * quiet 48h, never completed, never nudged. followUpSentAt makes it send once
     * — a daily "you didn't finish" email is how a warm lead becomes a spam
     * complaint. That stamp is also what makes this action VERIFIABLE: the
     * measurement shrinks because the rows leave the selector, not because a
     * counter moved.
     *
     * NOT gated on OUTREACH_AUTOMATION. That flag pauses cold prospecting; this is
     * a named person in the middle of an application he started.
     */
    measure: async (db) => db.collection("onboarding_sessions").countDocuments(stalledSessionFilter()),
    repair: async (db) => {
      const sessions = await db
        .collection("onboarding_sessions")
        .find(stalledSessionFilter())
        .sort({ lastActiveAt: 1 })
        .limit(25)
        .toArray();
      if (!sessions.length) return { affected: 0, detail: "no stalled applications" };

      const now = new Date();
      const escalate: {
        name: string;
        email: string;
        phone?: string;
        currentStep: number;
        idleDays: number;
      }[] = [];
      let emailed = 0;

      for (const s of sessions) {
        const email = String(s.formData?.email || s.email || "").trim();
        const name = String(s.formData?.firstName || s.name || "").trim();
        const step = Number(s.currentStep || 1);
        const lastActive = s.lastActiveAt ? new Date(s.lastActiveAt) : now;
        const idleDays = Math.floor((now.getTime() - lastActive.getTime()) / 86400_000);

        // The resume link WORKS for a non-completed session — session/route.ts
        // returns currentStep for exactly this purpose, and now self-renews an
        // expired one on click. No token means no usable link, so we escalate to
        // the owner and send nothing rather than mail out a dead URL.
        const rawToken = String(s.rawToken || "").trim();
        const sent =
          email && rawToken
            ? await sendOnboardingResumeNudge({
                name,
                email,
                resumeUrl: getOnboardingUrl(rawToken),
                currentStep: step,
              })
            : false;
        if (sent) emailed++;

        escalate.push({
          name,
          email,
          phone: String(s.formData?.phone || s.metadata?.phone || "").trim() || undefined,
          currentStep: step,
          idleDays,
        });

        // Stamped even when the send failed, so a permanently bad address does
        // not re-enter this loop hourly forever. The owner alert below carries
        // the person either way, which is the outcome that actually matters.
        await db.collection("onboarding_sessions").updateOne(
          { _id: s._id },
          { $set: { followUpSentAt: now, followUpEmailed: sent, updatedAt: now } }
        );
      }

      // The email is the automated half. This is the half that matters more:
      // these people left a phone number.
      await notifyStalledOnboarding(escalate);

      return {
        affected: sessions.length,
        detail: `${escalate.length} stalled applicant(s) escalated to the owner, ${emailed} resume email(s) sent`,
      };
    },
  },
];

/** Started, got somewhere real, went quiet, never nudged. */
function stalledSessionFilter() {
  return {
    status: "started",
    currentStep: { $gte: 3 },
    completedAt: { $exists: false },
    followUpSentAt: { $exists: false },
    lastActiveAt: { $lt: new Date(Date.now() - 48 * 3600_000) },
  };
}

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
