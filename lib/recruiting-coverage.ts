import type { Db } from "mongodb";
import { stageForProspect } from "@/lib/pipeline-stages";

/**
 * Recruiting coverage by state — REAL data for the ops dashboard map.
 *
 * Every outbound prospect carries a location (FMCSA prospecting samples
 * per-state), so the honest "operations map" is where the recruiting effort
 * actually is: prospects per state, split by pipeline stage. No fake GPS
 * dots, no placeholder tiles.
 */

export interface StateCoverage {
  state: string;
  total: number;
  /** Found but under the score threshold (parked at Sourced). */
  sourced: number;
  /** Scored 75+ / at the qualified stage. */
  qualified: number;
  /** Outreach email sent. */
  invited: number;
  /** Clicked their link or further (engaged, docs, completed, hired). */
  engagedPlus: number;
  rejected: number;
}

export interface RecruitingCoverage {
  states: StateCoverage[];
  totals: {
    prospects: number;
    statesCovered: number;
    qualified: number;
    invited: number;
    engagedPlus: number;
    unknownLocation: number;
  };
  generatedAt: string;
}

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

function extractState(doc: {
  state?: unknown;
  location?: unknown;
}): string | null {
  if (typeof doc.state === "string" && US_STATES.has(doc.state.toUpperCase())) {
    return doc.state.toUpperCase();
  }
  const loc = doc.location;
  if (loc && typeof loc === "object") {
    const s = (loc as { state?: unknown }).state;
    if (typeof s === "string" && US_STATES.has(s.toUpperCase())) return s.toUpperCase();
  }
  if (typeof loc === "string") {
    // "MESQUITE, TX 75149-3619" → TX
    const m = loc.match(/,\s*([A-Za-z]{2})(?=[\s,\d]|$)/);
    if (m && US_STATES.has(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return null;
}

type Bucket = "sourced" | "qualified" | "invited" | "engagedPlus" | "rejected";

const STAGE_TO_BUCKET: Record<string, Bucket> = {
  sourced: "sourced",
  unqualified: "sourced",
  qualified: "qualified",
  invited: "invited",
  engaged: "engagedPlus",
  docs: "engagedPlus",
  completed: "engagedPlus",
  hired: "engagedPlus",
  rejected: "rejected",
};

export async function getRecruitingCoverage(db: Db): Promise<RecruitingCoverage> {
  const docs = await db
    .collection("outbound_prospects")
    .find({}, { projection: { state: 1, location: 1, status: 1, aiScore: 1 } })
    .toArray();

  const byState = new Map<string, StateCoverage>();
  let unknownLocation = 0;
  let qualifiedTotal = 0;
  let invitedTotal = 0;
  let engagedTotal = 0;

  for (const doc of docs) {
    const state = extractState(doc as never);
    const badge = stageForProspect(doc as never);
    const bucket = STAGE_TO_BUCKET[badge.key] ?? "sourced";
    if (bucket === "qualified") qualifiedTotal += 1;
    if (bucket === "invited") invitedTotal += 1;
    if (bucket === "engagedPlus") engagedTotal += 1;

    if (!state) {
      unknownLocation += 1;
      continue;
    }
    let entry = byState.get(state);
    if (!entry) {
      entry = { state, total: 0, sourced: 0, qualified: 0, invited: 0, engagedPlus: 0, rejected: 0 };
      byState.set(state, entry);
    }
    entry.total += 1;
    entry[bucket] += 1;
  }

  const states = Array.from(byState.values()).sort((a, b) => b.total - a.total);

  return {
    states,
    totals: {
      prospects: docs.length,
      statesCovered: states.length,
      qualified: qualifiedTotal,
      invited: invitedTotal,
      engagedPlus: engagedTotal,
      unknownLocation,
    },
    generatedAt: new Date().toISOString(),
  };
}
