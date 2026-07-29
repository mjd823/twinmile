import type { Db } from "mongodb";

/**
 * SENDING POLICY — how much mail may leave, and what must be on it.
 *
 * Twin Mile sent 1,802 cold emails and got effectively nothing back. The
 * instinct is to rewrite the copy. The evidence says otherwise: at a 0.5%-ish
 * reply rate the problem is almost always PLACEMENT, not messaging — the mail
 * was delivered and filed somewhere nobody looks. Fixing copy before fixing
 * placement means A/B testing two messages that neither recipient will see.
 *
 * Three things govern placement, in order of impact:
 *
 *  1. VOLUME RAMP. A domain that has been quiet, then sends hundreds a day,
 *     reads as a compromised or purchased list. Sustained ceilings that
 *     practitioners report surviving on are 25-40/day per mailbox, ramped over
 *     4-6 weeks — not the 100/day this system was configured for.
 *
 *  2. BULK-SENDER COMPLIANCE. Gmail/Yahoo/Microsoft rules are explicit now:
 *     DMARC alignment, and RFC 8058 one-click unsubscribe that works without a
 *     login and is honored within 2 days. Complaint rate must stay under 0.30%,
 *     but enforcement STARTS at 0.30% — the number to operate to is 0.10%.
 *
 *  3. MESSAGE SHAPE. Open-tracking pixels and link rewriting are the strongest
 *     "this is marketing" signals available to a classifier. Removing open
 *     tracking is reported to move Primary-tab placement by 6-10 points and
 *     replies by 12-18%. It also costs nothing, because Apple Mail Privacy
 *     Protection pre-fetches images and makes open rates meaningless anyway.
 *
 * This module owns (1) and (2). (3) is a Resend dashboard setting plus the
 * plain-text templates.
 */

/**
 * Per-day ceilings by week of warmup. Index = completed weeks of sending.
 * Deliberately conservative at the start: the cost of ramping slowly is a few
 * weeks; the cost of ramping fast is a domain you cannot use again.
 */
const WARMUP_RAMP = [5, 10, 20, 30, 40];

/** Hard ceiling regardless of warmup age, per sending mailbox. */
export const MAX_DAILY_PER_MAILBOX = 40;

export interface SendAllowance {
  dailyCap: number;
  sentLast24h: number;
  remaining: number;
  warmupWeek: number;
  reason: string;
}

/**
 * How many sends are allowed right now. Derived from real send history rather
 * than a static env var, so the ramp advances on its own and cannot be
 * accidentally set to a number that burns the domain.
 *
 * OUTREACH_DAILY_CAP, when set, may only LOWER the computed cap. A config
 * value must never be able to raise the ceiling above what the domain has
 * earned — that is the exact mistake that makes warmup theater.
 */
export async function getSendAllowance(db: Db): Promise<SendAllowance> {
  const tasks = db.collection("outreach_tasks");
  const now = Date.now();

  const [firstSent, sentLast24h] = await Promise.all([
    tasks.findOne({ status: "sent" }, { sort: { sentAt: 1 }, projection: { sentAt: 1 } }),
    tasks.countDocuments({ status: "sent", sentAt: { $gte: new Date(now - 86400_000) } }),
  ]);

  // Sending history exists but has been dormant for weeks. Reputation decays;
  // resuming at full volume after a long silence looks exactly like a hijacked
  // domain, so the ramp restarts rather than picking up where it left off.
  const lastSent = await tasks.findOne(
    { status: "sent" },
    { sort: { sentAt: -1 }, projection: { sentAt: 1 } }
  );
  const daysSinceLastSend =
    lastSent?.sentAt instanceof Date ? Math.floor((now - lastSent.sentAt.getTime()) / 86400_000) : null;

  let warmupWeek: number;
  let reason: string;

  if (!firstSent?.sentAt) {
    warmupWeek = 0;
    reason = "no sending history — starting warmup at week 1";
  } else if (daysSinceLastSend !== null && daysSinceLastSend >= 14) {
    warmupWeek = 0;
    reason = `dormant ${daysSinceLastSend} days — warmup restarted`;
  } else {
    const weeks = Math.floor((now - (firstSent.sentAt as Date).getTime()) / (7 * 86400_000));
    warmupWeek = Math.min(weeks, WARMUP_RAMP.length - 1);
    reason = `warmup week ${warmupWeek + 1}`;
  }

  const rampCap = WARMUP_RAMP[warmupWeek];
  const envCap = parseInt(process.env.OUTREACH_DAILY_CAP || "", 10);
  const dailyCap = Number.isFinite(envCap) && envCap >= 0 ? Math.min(rampCap, envCap) : rampCap;

  return {
    dailyCap,
    sentLast24h,
    remaining: Math.max(0, dailyCap - sentLast24h),
    warmupWeek: warmupWeek + 1,
    reason:
      dailyCap < rampCap ? `${reason}; lowered to ${dailyCap} by OUTREACH_DAILY_CAP` : reason,
  };
}

/**
 * Headers required on every cold send. One-click unsubscribe is not optional
 * above the bulk threshold, and a List-Unsubscribe header that requires a login
 * or does not work does more harm than none at all.
 */
export function bulkSenderHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function unsubscribeUrlFor(token: string, baseUrl = "https://twinmile.com"): string {
  return `${baseUrl}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/**
 * Does the sending identity look like a robot? Robot mailboxes are one of the
 * stacked signals that route mail to Promotions, and they suppress replies on
 * their own — people do not answer a mailbox that announces nobody is home.
 */
export function isRobotSender(from: string): boolean {
  const addr = from.match(/<([^>]+)>/)?.[1] || from;
  return /^(no-?reply|alerts?|notifications?|do-?not-?reply|mailer|automated|system)@/i.test(addr.trim());
}
