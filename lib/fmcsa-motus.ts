import type { Db } from "mongodb";

import {
  getLanesForState,
  scoreCarrier,
  type CensusCarrier,
} from "@/lib/fmcsa-prospecting-core";

/**
 * FMCSA "Motus Carrier" licensing/insurance prioritizer — Sofia's
 * new-authority + insurance-lapse channel.
 *
 * Datasets (both on data.transportation.gov, field names verified live
 * 2026-07-08 via /api/views/<id>.json metadata + sample row queries):
 *
 *   nakq-58th  "Motus Carrier"                    — DAILY DIFF (~hundreds of
 *              rows/day): carriers whose operating-authority/insurance record
 *              changed in the last day. Appearing here is itself the recency
 *              signal.
 *   inys-ebih  "Motus Carrier - All With History" — full set (~73k rows),
 *              identical schema. Used as fallback when the diff is
 *              empty/unavailable, and for DOT lookups to enrich census hits.
 *
 * Shared schema (both): docket_number, usdot_number, op_auth_type,
 * op_auth_status (Active/Pending/Inactive/Withdrawn), min_cov_amount (BIPD
 * required, numeric string), bipd_file (BIPD on file, numeric string),
 * cargo_req/cargo_file, bond_req/bond_file, legal_name, dba_name,
 * bus_city/bus_state_code/bus_zip_code, bus_telno. NEITHER dataset has an
 * authority GRANT DATE — so "granted in the last N days" comes from the
 * Company Census (az4n-8mr2) `add_date` field cross-referenced by DOT.
 *
 * Channel design:
 *   fmcsa-new-authority   census carriers with add_date in the last
 *                         PRIORITY_WINDOW_DAYS in the priority states
 *                         (+20 priorityScore boost)
 *   fmcsa-insurance-lapse Motus rows where BIPD on file is 0/missing or
 *                         below the required minimum while authority is
 *                         Active/Pending (+15 boost). These carriers must
 *                         either fix insurance fast or lease onto someone
 *                         else's authority — exactly Twin Mile's offer.
 *
 * Everything merges into outbound_prospects deduped by DOT. Existing rows get
 * their priorityScore/sourceTag upgraded in place; new carriers are inserted
 * with full census enrichment (we only insert carriers we can verify in the
 * census as small-fleet general-freight — same quality bar as the daily
 * census channel).
 */

const MOTUS_DIFF_API = "https://data.transportation.gov/resource/nakq-58th.json";
const MOTUS_HISTORY_API = "https://data.transportation.gov/resource/inys-ebih.json";
const CENSUS_API = "https://data.transportation.gov/resource/az4n-8mr2.json";

/** New-authority lookback window (days). Spec: 30-60 — use the wide end. */
export const PRIORITY_WINDOW_DAYS = 60;

export const NEW_AUTHORITY_BOOST = 20;
export const INSURANCE_LAPSE_BOOST = 15;

export const DEFAULT_PRIORITY_STATES = ["TX", "LA", "OK", "AR", "NM"];

export type SourceTag =
  | "fmcsa-census"
  | "fmcsa-new-authority"
  | "fmcsa-insurance-lapse";

export interface MotusRow {
  docket_number?: string;
  usdot_number?: string;
  op_auth_type?: string;
  op_auth_status?: string;
  min_cov_amount?: string;
  bipd_file?: string;
  cargo_req?: string;
  cargo_file?: string;
  bond_req?: string;
  bond_file?: string;
  legal_name?: string;
  dba_name?: string;
  bus_city?: string;
  bus_state_code?: string;
  bus_zip_code?: string;
  bus_telno?: string;
}

export interface PriorityReport {
  states: string[];
  windowDays: number;
  motusSource: "nakq-58th (daily diff)" | "inys-ebih (history fallback)" | "unavailable";
  newAuthorityFound: number;
  insuranceLapseFound: number;
  bothSignals: number;
  inserted: number;
  updated: number;
  skippedNoCensusMatch: number;
  insertedByTag: Record<string, number>;
}

const CENSUS_SELECT =
  "dot_number,legal_name,dba_name,phy_city,phy_state,phy_zip,phone,power_units,total_drivers,classdef,email_address,carrier_operation,interstate_beyond_100_miles,hm_ind,mcs150_date,mcs150_mileage,add_date";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function socrataHeaders(appToken: string): Record<string, string> {
  return {
    "User-Agent": "TwinMile-Prospecting/1.0",
    Accept: "application/json",
    ...(appToken ? { "X-App-Token": appToken } : {}),
  };
}

async function socrataGet<T>(
  api: string,
  params: URLSearchParams,
  appToken: string
): Promise<T[]> {
  if (appToken) params.append("$$app_token", appToken);
  const response = await fetch(`${api}?${params.toString()}`, {
    headers: socrataHeaders(appToken),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Socrata ${api.split("/").pop()} error: ${response.status}`);
  }
  return (await response.json()) as T[];
}

/** YYYYMMDD string N days ago (census add_date is a YYYYMMDD text field). */
export function yyyymmdd(daysAgo: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function sqlStateList(states: string[]): string {
  return states.map((s) => `'${s.replace(/'/g, "")}'`).join(",");
}

/**
 * A Motus row counts as an insurance lapse/gap when the carrier holds (or is
 * pending) property authority but the BIPD insurance on file is missing,
 * zero, or below the required minimum. Values arrive as numeric strings
 * ("750000.000000000000000000").
 */
export function hasInsuranceLapse(row: MotusRow): boolean {
  const status = (row.op_auth_status || "").toLowerCase();
  if (status !== "active" && status !== "pending") return false;
  if (!(row.op_auth_type || "").toLowerCase().includes("motor carrier")) return false;
  const required = parseFloat(row.min_cov_amount || "0") || 0;
  const onFile = parseFloat(row.bipd_file || "0") || 0;
  if (required <= 0) return false; // nothing required — no lapse signal
  return onFile <= 0 || onFile < required;
}

/**
 * Pull the Motus daily diff for the priority states. Falls back to the
 * full-history dataset (lapse rows only, capped) if the diff is empty or
 * errors — same verified schema on both.
 */
export async function fetchMotusRows(
  states: string[],
  appToken: string
): Promise<{ rows: MotusRow[]; source: PriorityReport["motusSource"] }> {
  const where = `bus_state_code in(${sqlStateList(states)})`;
  try {
    const rows = await socrataGet<MotusRow>(
      MOTUS_DIFF_API,
      new URLSearchParams({ $where: where, $limit: "2000" }),
      appToken
    );
    if (rows.length > 0) return { rows, source: "nakq-58th (daily diff)" };
  } catch (err) {
    console.error(
      "[fmcsa-motus] daily diff (nakq-58th) failed, falling back to history:",
      err instanceof Error ? err.message : err
    );
  }

  // Fallback: history dataset — only pull rows that look like lapses so we
  // don't drag 73k rows through the function.
  try {
    const rows = await socrataGet<MotusRow>(
      MOTUS_HISTORY_API,
      new URLSearchParams({
        $where: `${where} AND op_auth_status in('Active','Pending') AND bipd_file < min_cov_amount`,
        $limit: "2000",
      }),
      appToken
    );
    return { rows, source: "inys-ebih (history fallback)" };
  } catch (err) {
    console.error(
      "[fmcsa-motus] history fallback (inys-ebih) failed:",
      err instanceof Error ? err.message : err
    );
    return { rows: [], source: "unavailable" };
  }
}

/**
 * Census carriers granted/added in the last `windowDays` days in the target
 * states — the "new authority" pool. Same small-fleet, general-freight,
 * for-hire quality bar as the daily census channel.
 */
export async function fetchNewAuthorityCarriers(
  states: string[],
  windowDays: number,
  appToken: string,
  perState = 100
): Promise<CensusCarrier[]> {
  const cutoff = yyyymmdd(windowDays);
  const out: CensusCarrier[] = [];
  for (const state of states) {
    const where = `phy_state='${state}' AND status_code='A' AND add_date > '${cutoff}' AND power_units IN ('1','2','3','4','5') AND crgo_genfreight='X' AND carrier_operation='C' AND hm_ind='N'`;
    try {
      const rows = await socrataGet<CensusCarrier>(
        CENSUS_API,
        new URLSearchParams({
          $select: CENSUS_SELECT,
          $where: where,
          $order: "add_date DESC",
          $limit: String(perState),
        }),
        appToken
      );
      out.push(...rows);
    } catch (err) {
      console.error(
        `[fmcsa-motus] census new-authority query failed for ${state}:`,
        err instanceof Error ? err.message : err
      );
    }
    await sleep(250);
  }
  return out;
}

/** Census lookup for a batch of DOT numbers (enrichment for Motus-only hits). */
export async function lookupCensusByDots(
  dots: string[],
  appToken: string
): Promise<Map<string, CensusCarrier>> {
  const map = new Map<string, CensusCarrier>();
  for (let i = 0; i < dots.length; i += 50) {
    const chunk = dots.slice(i, i + 50);
    try {
      const rows = await socrataGet<CensusCarrier>(
        CENSUS_API,
        new URLSearchParams({
          $select: CENSUS_SELECT,
          $where: `dot_number in(${sqlStateList(chunk)})`,
          $limit: "100",
        }),
        appToken
      );
      for (const row of rows) map.set(row.dot_number, row);
    } catch (err) {
      console.error(
        "[fmcsa-motus] census DOT lookup failed:",
        err instanceof Error ? err.message : err
      );
    }
    if (i + 50 < dots.length) await sleep(250);
  }
  return map;
}

/** Motus history lookup for a batch of DOTs (insurance status for census hits). */
export async function lookupMotusByDots(
  dots: string[],
  appToken: string
): Promise<Map<string, MotusRow>> {
  const map = new Map<string, MotusRow>();
  for (let i = 0; i < dots.length; i += 50) {
    const chunk = dots.slice(i, i + 50);
    try {
      const rows = await socrataGet<MotusRow>(
        MOTUS_HISTORY_API,
        new URLSearchParams({
          $where: `usdot_number in(${sqlStateList(chunk)})`,
          $limit: "200",
        }),
        appToken
      );
      for (const row of rows) {
        if (!row.usdot_number) continue;
        // Prefer the row with a lapse signal if a DOT has several authorities.
        const existing = map.get(row.usdot_number);
        if (!existing || (hasInsuranceLapse(row) && !hasInsuranceLapse(existing))) {
          map.set(row.usdot_number, row);
        }
      }
    } catch (err) {
      console.error(
        "[fmcsa-motus] motus DOT lookup failed:",
        err instanceof Error ? err.message : err
      );
    }
    if (i + 50 < dots.length) await sleep(250);
  }
  return map;
}

interface Candidate {
  census: CensusCarrier;
  tags: SourceTag[];
  motus?: MotusRow;
}

function primaryTag(tags: SourceTag[]): SourceTag {
  // New-authority is the stronger channel; it wins when both signals fire.
  return tags.includes("fmcsa-new-authority")
    ? "fmcsa-new-authority"
    : tags[0];
}

function boostFor(tags: SourceTag[]): number {
  let boost = 0;
  if (tags.includes("fmcsa-new-authority")) boost += NEW_AUTHORITY_BOOST;
  if (tags.includes("fmcsa-insurance-lapse")) boost += INSURANCE_LAPSE_BOOST;
  return boost;
}

/**
 * Run one prioritizer pass:
 *   1. census new-authority pool (add_date in window, priority states)
 *   2. Motus daily-diff insurance-lapse pool (same states)
 *   3. cross-enrich (Motus status for census hits, census data for Motus hits)
 *   4. merge-dedupe into outbound_prospects by DOT with priorityScore boosts
 *
 * Returns honest counts — 0s are valid results. Does NOT write
 * agent_activity; the caller logs its own run record.
 */
export async function runProspectPriorities(
  db: Db,
  options: { states?: string[]; windowDays?: number; appToken?: string } = {}
): Promise<PriorityReport> {
  const states =
    options.states ??
    (process.env.FMCSA_PRIORITY_STATES || DEFAULT_PRIORITY_STATES.join(","))
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  const windowDays = options.windowDays ?? PRIORITY_WINDOW_DAYS;
  const appToken = options.appToken ?? (process.env.SOCRATA_APP_TOKEN || "");
  const now = new Date();

  // ── 1+2. pull both pools ────────────────────────────────────────────────
  const [newAuthority, motusResult] = await Promise.all([
    fetchNewAuthorityCarriers(states, windowDays, appToken),
    fetchMotusRows(states, appToken),
  ]);

  const candidates = new Map<string, Candidate>();
  for (const carrier of newAuthority) {
    if (!carrier.dot_number) continue;
    candidates.set(carrier.dot_number, {
      census: carrier,
      tags: ["fmcsa-new-authority"],
    });
  }

  // ── 3a. Motus insurance status for the new-authority pool ───────────────
  const censusDots = [...candidates.keys()];
  const motusForCensus =
    censusDots.length > 0 ? await lookupMotusByDots(censusDots, appToken) : new Map<string, MotusRow>();
  for (const [dot, row] of motusForCensus) {
    const candidate = candidates.get(dot);
    if (!candidate) continue;
    candidate.motus = row;
    if (hasInsuranceLapse(row) && !candidate.tags.includes("fmcsa-insurance-lapse")) {
      candidate.tags.push("fmcsa-insurance-lapse");
    }
  }

  // ── 3b. Motus-diff lapse rows not already covered → census enrichment ───
  const lapseRows = motusResult.rows.filter(hasInsuranceLapse);
  const lapseOnlyDots = lapseRows
    .map((r) => r.usdot_number!)
    .filter((dot) => dot && !candidates.has(dot));
  let skippedNoCensusMatch = 0;
  if (lapseOnlyDots.length > 0) {
    const censusForLapse = await lookupCensusByDots([...new Set(lapseOnlyDots)], appToken);
    for (const row of lapseRows) {
      const dot = row.usdot_number;
      if (!dot || candidates.has(dot)) continue;
      const census = censusForLapse.get(dot);
      if (!census) {
        skippedNoCensusMatch++;
        continue; // can't verify carrier profile — don't insert blind
      }
      const units = parseInt(census.power_units || "0", 10);
      if (units < 1 || units > 5) {
        skippedNoCensusMatch++;
        continue; // outside the owner-operator/small-fleet target
      }
      candidates.set(dot, { census, tags: ["fmcsa-insurance-lapse"], motus: row });
    }
  }

  // ── 4. merge-dedupe into outbound_prospects ─────────────────────────────
  const allDots = [...candidates.keys()];
  const prospects = db.collection("outbound_prospects");
  const existingDocs =
    allDots.length > 0
      ? await prospects
          .find({ dotNumber: { $in: allDots } })
          .project({ dotNumber: 1, aiScore: 1, sourceTag: 1, sourceTags: 1 })
          .toArray()
      : [];
  const existingByDot = new Map(existingDocs.map((d) => [d.dotNumber as string, d]));

  let inserted = 0;
  let updated = 0;
  const insertedByTag: Record<string, number> = {};

  for (const [dot, candidate] of candidates) {
    const tags = candidate.tags;
    const boost = boostFor(tags);
    const tag = primaryTag(tags);
    const existing = existingByDot.get(dot);

    if (existing) {
      const baseScore = typeof existing.aiScore === "number" ? existing.aiScore : 0;
      const priorityScore = Math.min(100 + boost, baseScore + boost);
      const mergedTags = [
        ...new Set([...(existing.sourceTags || []), ...(existing.sourceTag ? [existing.sourceTag] : []), ...tags]),
      ];
      await prospects.updateOne(
        { dotNumber: dot },
        {
          $set: {
            priorityScore,
            sourceTag: tag,
            sourceTags: mergedTags,
            insuranceLapse: tags.includes("fmcsa-insurance-lapse"),
            newAuthority: tags.includes("fmcsa-new-authority"),
            priorityUpdatedAt: now.toISOString(),
          },
        }
      );
      updated++;
      continue;
    }

    const c = candidate.census;
    const { score, signals, analysis } = scoreCarrier(c);
    const tagSignals = [
      ...(tags.includes("fmcsa-new-authority")
        ? [`Authority added ${c.add_date?.substring(0, 4)}-${c.add_date?.substring(4, 6)}-${c.add_date?.substring(6, 8)} (new authority)`]
        : []),
      ...(tags.includes("fmcsa-insurance-lapse")
        ? ["BIPD insurance missing/below required minimum (lease-on opportunity)"]
        : []),
    ];

    await prospects.insertOne({
      id: `fmcsa_priority_${Date.now()}_${inserted}`,
      name: c.legal_name,
      dbaName: c.dba_name || null,
      contact: {
        phone: c.phone || candidate.motus?.bus_telno || null,
        email: c.email_address || null,
      },
      location: `${c.phy_city}, ${c.phy_state} ${c.phy_zip}`,
      city: c.phy_city,
      state: c.phy_state,
      zip: c.phy_zip,
      equipment: "Power-only / General Freight",
      experience: `${c.total_drivers} driver${parseInt(c.total_drivers || "1", 10) > 1 ? "s" : ""}, ${c.power_units} power unit${parseInt(c.power_units || "1", 10) > 1 ? "s" : ""}`,
      authorityStatus: "own",
      currentCarrier: c.dba_name || "Independent owner-operator",
      lanes: getLanesForState(c.phy_state),
      interestSignals: [...tagSignals, ...signals],
      source: "fmcsa_motus_api",
      sourceTag: tag,
      sourceTags: tags,
      sourceUrl: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dot}`,
      aiScore: score,
      priorityScore: Math.min(100 + boost, score + boost),
      insuranceLapse: tags.includes("fmcsa-insurance-lapse"),
      newAuthority: tags.includes("fmcsa-new-authority"),
      aiAnalysis:
        analysis.join("; ") ||
        "Real FMCSA-verified carrier — Motus licensing/insurance channel",
      status: score >= 75 ? "qualified" : "new",
      type: "outbound_driver",
      dotNumber: dot,
      classdef: c.classdef,
      powerUnits: parseInt(c.power_units || "0", 10),
      drivers: parseInt(c.total_drivers || "0", 10),
      interstate: c.interstate_beyond_100_miles === "1",
      motus: candidate.motus
        ? {
            docketNumber: candidate.motus.docket_number || null,
            opAuthStatus: candidate.motus.op_auth_status || null,
            bipdRequired: parseFloat(candidate.motus.min_cov_amount || "0") || 0,
            bipdOnFile: parseFloat(candidate.motus.bipd_file || "0") || 0,
          }
        : null,
      createdAt: now.toISOString(),
      enrichedAt: now.toISOString(),
      priorityUpdatedAt: now.toISOString(),
    });
    inserted++;
    insertedByTag[tag] = (insertedByTag[tag] || 0) + 1;
  }

  const bothSignals = [...candidates.values()].filter((c) => c.tags.length > 1).length;

  return {
    states,
    windowDays,
    motusSource: motusResult.source,
    newAuthorityFound: newAuthority.length,
    insuranceLapseFound: [...candidates.values()].filter((c) =>
      c.tags.includes("fmcsa-insurance-lapse")
    ).length,
    bothSignals,
    inserted,
    updated,
    skippedNoCensusMatch,
    insertedByTag,
  };
}
