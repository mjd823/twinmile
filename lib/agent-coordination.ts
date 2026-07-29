import type { Db } from "mongodb";
import { AGENT_CHARTERS, type AgentKey } from "./agent-charters";

/**
 * COORDINATION PRIMITIVES — the shared blackboard and the blocker registry.
 *
 * Two problems this solves:
 *
 * 1. AGENTS COULD NOT TALK. Every cron agent wrote a summary row into
 *    agent_activity and never read anyone else's. agent_activity is an
 *    append-only log for humans; it has no addressing, no state, and no way to
 *    say "I need you to do X". `agent_memos` is that channel: addressed,
 *    stateful, and read by the recipient on its next run.
 *
 * 2. A HUMAN BLOCKER STOPPED EVERYTHING. When the system needed a person to
 *    click something, work simply halted and the agents kept reporting the same
 *    number every day for a month. The `blockers` collection makes a blocked
 *    thing a first-class record that MUST carry a route-around, so the system
 *    keeps moving on a different path while the human item waits. Blockers are
 *    re-checked automatically and close themselves when the condition clears.
 *
 * Neither collection is allowed to grow without bound: memos expire, and
 * resolved blockers are retained (they are the audit trail of what stopped us).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Memos — the blackboard
// ─────────────────────────────────────────────────────────────────────────────

export type MemoKind =
  /** "Here is something I saw that is not mine to act on." */
  | "observation"
  /** "I need you to do something." Expects the recipient to act or decline. */
  | "request"
  /** "I did my part; the work is now yours." */
  | "handoff"
  /** "The thing you raised is resolved." Closes the referenced memo. */
  | "resolution";

export interface AgentMemo {
  from: AgentKey;
  /** A specific agent, or "all" for the whole team. */
  to: AgentKey | "all";
  kind: MemoKind;
  subject: string;
  body: string;
  /** Numbers/IDs the memo rests on, so the reader can verify rather than trust. */
  evidence?: string;
  /** _id of the memo this responds to. */
  inReplyTo?: string;
  status: "open" | "acknowledged" | "resolved" | "declined";
  createdAt: Date;
  expiresAt: Date;
}

const MEMO_TTL_DAYS = 14;
const MAX_MEMOS_READ = 25;

export async function writeMemo(
  db: Db,
  memo: Omit<AgentMemo, "status" | "createdAt" | "expiresAt"> & { status?: AgentMemo["status"] }
): Promise<void> {
  const now = new Date();
  await db.collection("agent_memos").insertOne({
    ...memo,
    subject: memo.subject.slice(0, 200),
    body: memo.body.slice(0, 2000),
    status: memo.status ?? "open",
    createdAt: now,
    expiresAt: new Date(now.getTime() + MEMO_TTL_DAYS * 86400_000),
  });
}

/**
 * What an agent should read before it reasons: memos addressed to it or to
 * everyone, plus recent memos from the peers its charter says it depends on.
 * This is the mechanism by which an agent "understands the others' workflow" —
 * it literally reads their output.
 */
export async function readInbox(db: Db, agent: AgentKey): Promise<AgentMemo[]> {
  const peers = AGENT_CHARTERS[agent].readsFrom;
  const rows = await db
    .collection("agent_memos")
    .find({
      expiresAt: { $gt: new Date() },
      $or: [
        { to: agent, status: { $in: ["open", "acknowledged"] } },
        { to: "all", status: { $in: ["open", "acknowledged"] } },
        { from: { $in: peers }, status: "open" },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(MAX_MEMOS_READ)
    .toArray();
  return rows as unknown as AgentMemo[];
}

export async function closeMemo(
  db: Db,
  memoId: string,
  status: "acknowledged" | "resolved" | "declined",
  note?: string
): Promise<void> {
  const { ObjectId } = await import("mongodb");
  let _id: unknown;
  try {
    _id = new ObjectId(memoId);
  } catch {
    return;
  }
  await db
    .collection("agent_memos")
    .updateOne(
      { _id: _id as never },
      { $set: { status, closedAt: new Date(), ...(note ? { closeNote: note.slice(0, 500) } : {}) } }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Blockers — "a human has to do this, so route around it and keep moving"
// ─────────────────────────────────────────────────────────────────────────────

export type BlockerOwner = "human" | "agent" | "vendor";

export interface Blocker {
  /** Stable slug — re-raising the same blocker updates rather than duplicates. */
  key: string;
  title: string;
  /** Who must act. "human" blockers are never treated as failures. */
  owner: BlockerOwner;
  /** What is not happening because of this. */
  blocking: string;
  /**
   * REQUIRED. The whole point: what the system does INSTEAD while this waits.
   * A blocker without a route-around is a stop, and the system does not stop.
   */
  routeAround: string;
  /** Plain-English instruction for the owner, if human. */
  humanAction?: string;
  /** Machine-checkable condition that means this is resolved. */
  clearsWhen: string;
  severity: "critical" | "warning" | "info";
  status: "open" | "resolved";
  raisedBy: AgentKey;
  firstRaisedAt: Date;
  lastSeenAt: Date;
  resolvedAt?: Date;
  /** How many agent runs have proceeded via the route-around. */
  routedAroundCount: number;
}

/**
 * Raise (or refresh) a blocker. Idempotent on `key` — an agent that hits the
 * same wall every 15 minutes produces ONE record with a bumped counter, not
 * 96 rows a day.
 */
export async function raiseBlocker(
  db: Db,
  b: Omit<Blocker, "status" | "firstRaisedAt" | "lastSeenAt" | "routedAroundCount">
): Promise<void> {
  const now = new Date();
  await db.collection("blockers").updateOne(
    { key: b.key },
    {
      $set: {
        title: b.title,
        owner: b.owner,
        blocking: b.blocking,
        routeAround: b.routeAround,
        ...(b.humanAction ? { humanAction: b.humanAction } : {}),
        clearsWhen: b.clearsWhen,
        severity: b.severity,
        raisedBy: b.raisedBy,
        status: "open",
        lastSeenAt: now,
      },
      $setOnInsert: { firstRaisedAt: now },
      $inc: { routedAroundCount: 1 },
      $unset: { resolvedAt: "" },
    },
    { upsert: true }
  );
}

/** Close a blocker whose `clearsWhen` condition is now satisfied. */
export async function resolveBlocker(db: Db, key: string, note?: string): Promise<boolean> {
  const res = await db.collection("blockers").updateOne(
    { key, status: "open" },
    {
      $set: {
        status: "resolved",
        resolvedAt: new Date(),
        ...(note ? { resolutionNote: note.slice(0, 500) } : {}),
      },
    }
  );
  return res.modifiedCount > 0;
}

export async function openBlockers(db: Db): Promise<Blocker[]> {
  const rows = await db
    .collection("blockers")
    .find({ status: "open" })
    .sort({ severity: 1, firstRaisedAt: 1 })
    .limit(50)
    .toArray();
  return rows as unknown as Blocker[];
}

/**
 * Is a given capability currently blocked? Agents call this to decide whether
 * to take the main path or the route-around. Returns the blocker so the agent
 * can log WHICH alternative path it took and why.
 */
export async function blockerFor(db: Db, key: string): Promise<Blocker | null> {
  const row = await db.collection("blockers").findOne({ key, status: "open" });
  return (row as unknown as Blocker) || null;
}
