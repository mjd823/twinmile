import type { Db, Document } from "mongodb";

/**
 * CANONICAL PIPELINE TAXONOMY — the single source of truth for the driver
 * recruiting funnel (and the small quote-lead pipeline).
 *
 * RULES (enforced by review, imported everywhere):
 *  - No page, component, or API route may define a stage label, stage color,
 *    or stage-count query anywhere else. They import from this module.
 *  - The word "Qualified" ALWAYS means "AI score >= 75" (cumulative). The
 *    handful of leads sitting at the qualified stage waiting for an invite are
 *    "Awaiting invite" (the in-stage count), never "Qualified" alone.
 *  - "Invited" always means "outreach email sent".
 *  - Raw "onboarding sessions" counts are BANNED from UI. Sessions surface
 *    only through the engaged / docs / completed stages (a `pending` session
 *    is just an invite record — that is already the Invited stage).
 *
 * TWO NUMBERS PER STAGE, both always labeled:
 *  - reached (cumulative): everyone who ever reached-or-passed the stage.
 *    Monotonically shrinking — the funnel shape.
 *  - inStage ("here now", resting): who is currently parked in the stage.
 *    Mutually exclusive; resting counts sum to the total.
 *
 * Root cause this fixes: each prospect holds exactly ONE status, so inviting
 * a prospect moves it OUT of qualified INTO invited. Resting counts side by
 * side are NOT a funnel (956 Invited next to 2 Qualified looked like
 * nonsense). Cumulative "reached" counts restore the funnel shape the owner
 * expects, and "here now" chips show where everyone is parked.
 */

/** The magic number lives here only. */
export const QUALIFIED_SCORE_THRESHOLD = 75;

export type StageKey =
  | "sourced"
  | "qualified"
  | "invited"
  | "engaged"
  | "docs"
  | "completed"
  | "hired";

export type OffFunnelKey = "rejected" | "unqualified";

export interface StageDef {
  key: StageKey;
  /** Full display name, e.g. "Qualified (AI score ≥75)". */
  label: string;
  /** Short display name for chips/columns, e.g. "Qualified". */
  shortLabel: string;
  /** Plain-English definition shown as helper text. */
  description: string;
  /** What the in-stage ("here now") number means for this stage. */
  inStageLabel: string;
  hex: string;
  tailwind: string;
  order: number;
}

export const PIPELINE_STAGES: StageDef[] = [
  {
    key: "sourced",
    label: "Prospects Sourced",
    shortLabel: "Sourced",
    description: "Every carrier or driver we have found",
    inStageLabel: "new, not yet qualified",
    hex: "#64748b",
    tailwind: "slate-500",
    order: 1,
  },
  {
    key: "qualified",
    label: "Qualified (AI score ≥75)",
    shortLabel: "Qualified",
    description: "Scored 75+ by AI — worth pursuing",
    inStageLabel: "awaiting invite",
    hex: "#3b82f6",
    tailwind: "blue-500",
    order: 2,
  },
  {
    key: "invited",
    label: "Invited (email sent)",
    shortLabel: "Invited",
    description: "Outreach email with onboarding link sent",
    inStageLabel: "waiting on a click",
    hex: "#6366f1",
    tailwind: "indigo-500",
    order: 3,
  },
  {
    key: "engaged",
    label: "Engaged (clicked link)",
    shortLabel: "Engaged",
    description: "Opened their onboarding link — warmest leads",
    inStageLabel: "in onboarding",
    hex: "#8b5cf6",
    tailwind: "violet-500",
    order: 4,
  },
  {
    key: "docs",
    label: "Docs Submitted",
    shortLabel: "Docs",
    description: "CDL, COI, W-9 documents submitted",
    inStageLabel: "docs under review",
    hex: "#a855f7",
    tailwind: "purple-500",
    order: 5,
  },
  {
    key: "completed",
    label: "Onboarding Complete",
    shortLabel: "Completed",
    description: "Finished onboarding, ready for a lease",
    inStageLabel: "awaiting lease signature",
    hex: "#d946ef",
    tailwind: "fuchsia-500",
    order: 6,
  },
  {
    key: "hired",
    label: "Hired / Active",
    shortLabel: "Hired",
    description: "Converted — driving with Twin Mile",
    inStageLabel: "active drivers",
    hex: "#10b981",
    tailwind: "emerald-500",
    order: 7,
  },
];

export const OFF_FUNNEL_BUCKETS: { key: OffFunnelKey; label: string; hex: string; description: string }[] = [
  {
    key: "rejected",
    label: "Rejected / Lost",
    hex: "#ef4444",
    description: "Rejected, lost, or unsubscribed",
  },
  {
    key: "unqualified",
    label: "Below score 75",
    hex: "#94a3b8",
    description: "Still new with an AI score under 75",
  },
];

const STAGE_BY_KEY = new Map(PIPELINE_STAGES.map((s) => [s.key, s]));
export function stageDef(key: StageKey): StageDef {
  return STAGE_BY_KEY.get(key)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status → stage maps (exhaustive, incl. legacy values)
// ─────────────────────────────────────────────────────────────────────────────

/** The only statuses prospecting writers are allowed to create. */
export type ProspectWriteStatus = "new" | "qualified";
export const PROSPECT_STATUSES: ProspectWriteStatus[] = ["new", "qualified"];

export const PROSPECT_STATUS_TO_STAGE: Record<string, StageKey | "rejected"> = {
  new: "sourced",
  "": "sourced",
  qualified: "qualified",
  reviewed: "qualified", // legacy drain-through status (migrated to "qualified")
  negotiating: "qualified", // legacy
  onboarding_invited: "invited",
  onboarding: "invited", // legacy
  replied: "engaged", // set by the inbound-reply webhook
  compliance_check: "engaged", // legacy
  documents_submitted: "docs",
  ready_to_dispatch: "completed",
  converted: "hired",
  rejected: "rejected",
  lost: "rejected",
  unsubscribed: "rejected",
};

export const DRIVER_LEAD_STATUS_TO_STAGE: Record<string, StageKey | "rejected"> = {
  new: "sourced",
  "": "sourced",
  qualified: "qualified",
  contacted: "qualified", // legacy
  negotiating: "qualified", // legacy
  onboarding: "invited",
  onboarding_invited: "invited",
  replied: "engaged",
  compliance_check: "engaged", // legacy
  documents_submitted: "docs",
  ready_to_dispatch: "completed",
  converted: "hired",
  rejected: "rejected",
  lost: "rejected",
};

export const SESSION_STATUS_TO_STAGE: Record<string, StageKey> = {
  pending: "invited", // a pending session IS the invite record
  started: "engaged",
  documents_submitted: "docs",
  completed: "completed",
};

/**
 * ONE definition of "engaged" (kills the 6-vs-7 discrepancy between pages).
 * NO leadType filter — any invited person who engaged counts.
 */
export const ENGAGED_SESSION_FILTER = {
  $or: [
    { firstClickedAt: { $exists: true } },
    { currentStep: { $gt: 1 } },
    { status: { $in: ["started", "documents_submitted", "completed"] } },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Row-badge helpers — kanban/list chips use identical logic everywhere
// ─────────────────────────────────────────────────────────────────────────────

export interface StageBadge {
  key: StageKey | OffFunnelKey;
  label: string;
  hex: string;
}

function badgeFor(mapped: StageKey | "rejected" | undefined, aiScore: number): StageBadge {
  if (mapped === "rejected") {
    const b = OFF_FUNNEL_BUCKETS[0];
    return { key: b.key, label: b.label, hex: b.hex };
  }
  let key: StageKey = mapped ?? "sourced";
  // A "new" record that already scored >= 75 is qualified by score.
  if (key === "sourced" && aiScore >= QUALIFIED_SCORE_THRESHOLD) key = "qualified";
  const def = stageDef(key);
  return { key: def.key, label: def.shortLabel, hex: def.hex };
}

export function stageForProspect(doc: { status?: string | null; aiScore?: number | null }): StageBadge {
  return badgeFor(PROSPECT_STATUS_TO_STAGE[doc.status || ""], doc.aiScore || 0);
}

export function stageForDriverLead(doc: { status?: string | null; aiScore?: number | null }): StageBadge {
  return badgeFor(DRIVER_LEAD_STATUS_TO_STAGE[doc.status || ""], doc.aiScore || 0);
}

export function stageForSession(doc: {
  status?: string | null;
  firstClickedAt?: unknown;
  currentStep?: number | null;
}): StageBadge {
  let key: StageKey = SESSION_STATUS_TO_STAGE[doc.status || "pending"] ?? "invited";
  if (key === "invited" && (doc.firstClickedAt || (doc.currentStep || 0) > 1)) key = "engaged";
  const def = stageDef(key);
  return { key: def.key, label: def.shortLabel, hex: def.hex };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE counting function
// ─────────────────────────────────────────────────────────────────────────────

export interface StageCounts {
  key: StageKey;
  label: string;
  shortLabel: string;
  description: string;
  inStageLabel: string;
  hex: string;
  order: number;
  /** Cumulative: reached-or-passed this stage. Funnel bars use this. */
  reached: number;
  /** Resting: currently parked here. Chips / kanban columns use this. */
  inStage: number;
  /** reached / previous stage reached, 0–100 (null for the first stage). */
  conversionFromPrev: number | null;
  /** True when reached > previous reached — surfaced, never silently clamped. */
  anomaly?: boolean;
}

export interface PipelineCounts {
  stages: StageCounts[];
  offFunnel: { key: OffFunnelKey; label: string; hex: string; description: string; count: number }[];
  totals: { prospects: number; driverLeads: number; sessions: number };
  /** True if any stage violated funnel monotonicity. */
  hasAnomaly: boolean;
  generatedAt: string;
}

async function statusCounts(db: Db, collection: string, match: Document = {}): Promise<Record<string, number>> {
  const rows = await db
    .collection(collection)
    .aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ["$status", ""] }, count: { $sum: 1 } } },
    ])
    .toArray();
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r._id)] = r.count as number;
  return out;
}

function sum(by: Record<string, number>, statuses: string[]): number {
  return statuses.reduce((acc, s) => acc + (by[s] || 0), 0);
}

/**
 * Compute the canonical funnel over the FULL collections. One $group per
 * collection + a handful of countDocuments — no capped row samples anywhere.
 */
export async function getPipelineCounts(db: Db): Promise<PipelineCounts> {
  const [pBy, dBy, sBy, engagedSessions, scoreQualifiedOrPast, leases, leasesApproved] =
    await Promise.all([
      statusCounts(db, "outbound_prospects"),
      statusCounts(db, "leads_drivers", { isArchived: { $ne: true } }),
      statusCounts(db, "onboarding_sessions"),
      db.collection("onboarding_sessions").countDocuments(ENGAGED_SESSION_FILTER as Document),
      // Reached-qualified prospects: score >= 75 OR status at/past qualified.
      db.collection("outbound_prospects").countDocuments({
        $or: [
          { aiScore: { $gte: QUALIFIED_SCORE_THRESHOLD } },
          {
            status: {
              $in: [
                "qualified",
                "reviewed",
                "negotiating",
                "onboarding_invited",
                "onboarding",
                "replied",
                "compliance_check",
                "documents_submitted",
                "ready_to_dispatch",
                "converted",
              ],
            },
          },
        ],
      }),
      db.collection("lease_agreements").countDocuments(),
      db.collection("lease_agreements").countDocuments({ status: "approved" }),
    ]);

  const prospectsTotal = Object.values(pBy).reduce((a, b) => a + b, 0);
  const driverLeadsTotal = Object.values(dBy).reduce((a, b) => a + b, 0);
  const sessionsTotal = Object.values(sBy).reduce((a, b) => a + b, 0);

  // Off-funnel resting buckets (never drawn as funnel bars).
  const rejected =
    sum(pBy, ["rejected", "lost", "unsubscribed"]) + sum(dBy, ["rejected", "lost"]);
  const unqualified = await db.collection("outbound_prospects").countDocuments({
    $or: [{ status: "new" }, { status: { $exists: false } }],
    $nor: [{ aiScore: { $gte: QUALIFIED_SCORE_THRESHOLD } }],
  });

  // ── Reached (cumulative) ──────────────────────────────────────────────────
  const dQualifiedOrPast = sum(dBy, [
    "qualified",
    "contacted",
    "negotiating",
    "onboarding",
    "onboarding_invited",
    "replied",
    "compliance_check",
    "documents_submitted",
    "ready_to_dispatch",
    "converted",
  ]);
  const pInvitedOrPast = sum(pBy, [
    "onboarding_invited",
    "onboarding",
    "replied",
    "compliance_check",
    "documents_submitted",
    "ready_to_dispatch",
    "converted",
  ]);
  const dInvitedOrPast = sum(dBy, [
    "onboarding",
    "onboarding_invited",
    "replied",
    "compliance_check",
    "documents_submitted",
    "ready_to_dispatch",
    "converted",
  ]);
  const pPastInvited = sum(pBy, ["replied", "compliance_check", "documents_submitted", "ready_to_dispatch", "converted"]);
  const dPastInvited = sum(dBy, ["replied", "compliance_check", "documents_submitted", "ready_to_dispatch", "converted"]);

  const docsReached = sum(sBy, ["documents_submitted", "completed"]);
  const completedReached = Math.max(sBy["completed"] || 0, leases);
  const hiredReached = (pBy["converted"] || 0) + (dBy["converted"] || 0) + leasesApproved;

  const reached: Record<StageKey, number> = {
    // Everything sourced except off-funnel rejected records.
    sourced: prospectsTotal + driverLeadsTotal - rejected,
    qualified: scoreQualifiedOrPast + dQualifiedOrPast,
    invited: pInvitedOrPast + dInvitedOrPast,
    // Engaged sessions (the ONE definition) + anyone whose status moved past
    // invited without a session record.
    engaged: engagedSessions + pPastInvited + dPastInvited,
    docs: docsReached,
    completed: completedReached,
    hired: hiredReached,
  };

  // ── In-stage (resting; mutually exclusive) ────────────────────────────────
  const inStage: Record<StageKey, number> = {
    sourced: (pBy["new"] || 0) + (pBy[""] || 0) + (dBy["new"] || 0) + (dBy[""] || 0),
    qualified:
      sum(pBy, ["qualified", "reviewed", "negotiating"]) +
      sum(dBy, ["qualified", "contacted", "negotiating"]),
    // Invited-and-waiting = currently invited minus those who engaged.
    invited: Math.max(
      0,
      sum(pBy, ["onboarding_invited", "onboarding"]) +
        sum(dBy, ["onboarding", "onboarding_invited"]) -
        reached.engaged
    ),
    engaged:
      Math.max(0, engagedSessions - docsReached) +
      sum(pBy, ["replied", "compliance_check"]) +
      sum(dBy, ["replied", "compliance_check"]),
    docs: sBy["documents_submitted"] || 0,
    completed:
      Math.max(0, (sBy["completed"] || 0) - hiredReached) +
      sum(pBy, ["ready_to_dispatch"]) +
      sum(dBy, ["ready_to_dispatch"]),
    hired: hiredReached,
  };

  // ── Assemble + monotonicity check (assert, don't clamp) ───────────────────
  let hasAnomaly = false;
  const stages: StageCounts[] = PIPELINE_STAGES.map((def, i) => {
    const prev = i === 0 ? null : PIPELINE_STAGES[i - 1];
    const prevReached = prev ? reached[prev.key] : null;
    const anomaly = prevReached !== null && reached[def.key] > prevReached;
    if (anomaly) hasAnomaly = true;
    return {
      key: def.key,
      label: def.label,
      shortLabel: def.shortLabel,
      description: def.description,
      inStageLabel: def.inStageLabel,
      hex: def.hex,
      order: def.order,
      reached: reached[def.key],
      inStage: inStage[def.key],
      conversionFromPrev:
        prevReached === null || prevReached === 0
          ? prevReached === null
            ? null
            : 0
          : Math.round((reached[def.key] / prevReached) * 1000) / 10,
      ...(anomaly ? { anomaly: true } : {}),
    };
  });

  return {
    stages,
    offFunnel: [
      { ...OFF_FUNNEL_BUCKETS[0], count: rejected },
      { ...OFF_FUNNEL_BUCKETS[1], count: unqualified },
    ],
    totals: { prospects: prospectsTotal, driverLeads: driverLeadsTotal, sessions: sessionsTotal },
    hasAnomaly,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote-lead pipeline (small parallel taxonomy so it stops being redefined
// inline). Statuses are mutually exclusive; these are resting counts.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuoteStageDef {
  key: string;
  label: string;
  hex: string;
  statuses: string[];
}

export const QUOTE_STAGES: QuoteStageDef[] = [
  { key: "new", label: "New", hex: "#64748b", statuses: ["new", ""] },
  { key: "contacted", label: "Contacted", hex: "#0ea5e9", statuses: ["contacted"] },
  { key: "qualified", label: "Qualified", hex: "#3b82f6", statuses: ["qualified"] },
  { key: "negotiating", label: "Negotiating", hex: "#f59e0b", statuses: ["quoted", "negotiating"] },
  { key: "converted", label: "Won", hex: "#10b981", statuses: ["converted"] },
  { key: "lost", label: "Lost", hex: "#ef4444", statuses: ["lost", "archived"] },
];

export interface QuoteStageCounts {
  stages: { key: string; label: string; hex: string; count: number }[];
  total: number;
}

export async function getQuoteStageCounts(db: Db): Promise<QuoteStageCounts> {
  const qBy = await statusCounts(db, "leads_quotes", { isArchived: { $ne: true } });
  const total = Object.values(qBy).reduce((a, b) => a + b, 0);
  return {
    stages: QUOTE_STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      hex: s.hex,
      count: sum(qBy, s.statuses),
    })),
    total,
  };
}
