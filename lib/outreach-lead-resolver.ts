import { ObjectId, type Db } from "mongodb";

/**
 * ONE resolver for "which lead does this outreach_task point at?".
 *
 * WHY THIS FILE EXISTS: the sender (app/api/cron/process-outreach) and the
 * repair loop (lib/autoheal) each had their own copy of this logic, and they
 * DISAGREED. The sender tries _id, then ObjectId(_id), then falls back to the
 * task's leadEmail; autoheal only tried _id. So autoheal declared 59 tasks
 * permanently orphaned ("lead record no longer exists") when the sender's own
 * resolver finds all 59 by email — their prospect rows were duplicated in June,
 * queued against the duplicate, then the duplicate was deleted, leaving the
 * original alive under a different _id.
 *
 * An aliveness check that is weaker than the send path will always bury
 * reachable work. Both paths import from here so they cannot drift again.
 */

/** Loose on purpose: leads come from three collections with three shapes. */
export type ResolvedLead = Record<string, any>;

export function leadCollectionFor(task: any): string {
  if (task.leadType === "quote") return "leads_quotes";
  if (task.leadType === "outbound_prospect") return "outbound_prospects";
  if (task.leadCollection === "outbound_prospects") return "outbound_prospects";
  return "leads_drivers";
}

/**
 * Resolve the lead behind a task, in the order the sender uses:
 *   1. leadId as stored (usually an ObjectId)
 *   2. leadId coerced from string -> ObjectId (legacy rows stored strings)
 *   3. leadEmail against contact.email / email (catches stale-pointer orphans)
 *
 * Returns null only when the person really is unreachable.
 */
export async function resolveLead(db: Db, task: any): Promise<ResolvedLead | null> {
  const coll = leadCollectionFor(task);
  let lead = await db.collection(coll).findOne({ _id: task.leadId });
  if (!lead && typeof task.leadId === "string") {
    try {
      lead = await db.collection(coll).findOne({ _id: new ObjectId(task.leadId) });
    } catch {
      // not a valid ObjectId string
    }
  }
  if (!lead && task.leadEmail) {
    lead = await db
      .collection(coll)
      .findOne({ $or: [{ "contact.email": task.leadEmail }, { email: task.leadEmail }] });
  }
  return lead;
}
