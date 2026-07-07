import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/cron/prospecting
 *
 * Vercel cron port of scripts/fmcsa-prospecting.mjs -- Sofia Rodriguez's
 * daily FMCSA Company Census prospecting run (previously the laptop Hermes
 * job "Sofia — Outbound Prospecting", 8AM CT).
 *
 * Queries the FMCSA Company Census File via the public Socrata API at
 * data.transportation.gov for REAL owner-operators (1-5 power units, 1-3
 * drivers, general freight, authorized for hire) in the target states,
 * scores them, and inserts new ones into outbound_prospects (deduped by
 * DOT number).
 *
 * Env (all optional):
 *   FMCSA_TARGET_STATES  comma list, default "TX,LA,CA,GA,TN"
 *   FMCSA_MAX_RESULTS    default 30
 *   SOCRATA_APP_TOKEN    higher Socrata rate limits
 *
 * ALWAYS logs a run record to agent_activity (action: "fmcsa_prospecting",
 * agent: Sofia Rodriguez) -- same action name the admin cron monitor watches.
 *
 * Schedule (vercel.json): "0 13 * * *" UTC = 8AM CDT / 7AM CST.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CENSUS_API = "https://data.transportation.gov/resource/az4n-8mr2.json";

const SOFIA = {
  name: "Sofia Rodriguez",
  role: "Lead Generation Specialist",
  department: "Sales",
};

interface CensusCarrier {
  dot_number: string;
  legal_name: string;
  dba_name?: string;
  phy_city?: string;
  phy_state?: string;
  phy_zip?: string;
  phone?: string;
  power_units?: string;
  total_drivers?: string;
  classdef?: string;
  email_address?: string;
  carrier_operation?: string;
  interstate_beyond_100_miles?: string;
  hm_ind?: string;
  mcs150_date?: string;
  mcs150_mileage?: string;
  add_date?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Query the FMCSA Census API for real owner-operators in one state,
 * excluding DOT numbers already in our DB. Ordering/offset/filters are
 * randomized per run so we sample DIFFERENT carriers each day.
 */
async function queryCarriersByState(
  state: string,
  limit: number,
  existingDOTs: Set<string>,
  appToken: string
): Promise<CensusCarrier[]> {
  const select =
    "dot_number,legal_name,dba_name,phy_city,phy_state,phy_zip,phone,power_units,total_drivers,classdef,email_address,carrier_operation,interstate_beyond_100_miles,hm_ind,mcs150_date,mcs150_mileage,add_date";

  const orderStrategies = [
    "dot_number DESC",
    "dot_number ASC",
    "mcs150_mileage DESC",
    "mcs150_date DESC",
    "add_date DESC",
    "total_drivers ASC, dot_number DESC",
  ];
  const randomOrder = orderStrategies[Math.floor(Math.random() * orderStrategies.length)];
  const randomOffset = Math.floor(Math.random() * 200);

  const driverFilters = [
    "total_drivers='1'",
    "total_drivers='2'",
    "total_drivers IN ('1','2')",
    "power_units='1'",
    "power_units IN ('2','3')",
  ];
  const randomDriverFilter = driverFilters[Math.floor(Math.random() * driverFilters.length)];

  const where = `phy_state='${state}' AND status_code='A' AND ${randomDriverFilter} AND power_units IN ('1','2','3','4','5') AND crgo_genfreight='X' AND carrier_operation='C' AND hm_ind='N'`;

  const params = new URLSearchParams({
    $select: select,
    $where: where,
    $limit: String(limit + randomOffset),
    $order: randomOrder,
  });
  if (appToken) params.append("$$app_token", appToken);

  try {
    const response = await fetch(`${CENSUS_API}?${params.toString()}`, {
      headers: {
        "User-Agent": "TwinMile-Prospecting/1.0",
        Accept: "application/json",
        ...(appToken ? { "X-App-Token": appToken } : {}),
      },
      // Keep per-state timeouts short so 5 states always fit in maxDuration.
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[cron/prospecting] API error for ${state}: ${response.status}`);
      return [];
    }

    const allResults: CensusCarrier[] = await response.json();
    const newCarriers = allResults.filter((c) => !existingDOTs.has(c.dot_number));

    // If the top of the result set was mostly duplicates, sample deeper.
    if (newCarriers.length < limit && allResults.length > randomOffset) {
      const deeperSlice = allResults
        .slice(randomOffset)
        .filter((c) => !existingDOTs.has(c.dot_number));
      if (deeperSlice.length > newCarriers.length) {
        return deeperSlice.slice(0, limit);
      }
    }

    return newCarriers.slice(0, limit);
  } catch (err) {
    console.error(
      `[cron/prospecting] Error querying ${state}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Score a carrier from REAL FMCSA data -- same rubric as the legacy script:
 * authority, interstate ops, fleet size, mileage, MCS-150 recency,
 * contactability, years in operation, DBA branding. Unreachable or
 * likely-inactive carriers are capped below the qualification threshold.
 */
function scoreCarrier(carrier: CensusCarrier): {
  score: number;
  signals: string[];
  analysis: string[];
} {
  let score = 0;
  const signals: string[] = [];
  const analysis: string[] = [];
  const disqualifiers: string[] = [];

  if (carrier.classdef && carrier.classdef.includes("AUTHORIZED FOR HIRE")) {
    score += 15;
    signals.push("Active for-hire authority");
  } else if (carrier.classdef && carrier.classdef.includes("AUTHORIZED")) {
    score += 8;
  } else {
    analysis.push("No active for-hire authority — lower priority");
  }

  if (carrier.interstate_beyond_100_miles && carrier.interstate_beyond_100_miles !== "0") {
    score += 10;
    signals.push("Interstate operations (long-haul capable)");
  }

  const units = parseInt(carrier.power_units || "0", 10);
  const drivers = parseInt(carrier.total_drivers || "0", 10);
  if (units === 1 && drivers === 1) {
    score += 15;
    signals.push("True owner-operator (1 truck, 1 driver)");
    analysis.push("Solo owner-operator — ideal power-only target");
  } else if (units === 1) {
    score += 12;
    signals.push("Single power unit");
  } else if (units >= 2 && units <= 3) {
    score += 8;
    signals.push(`${units} power units (small fleet)`);
    analysis.push("Small fleet — may need multi-truck lease");
  } else if (units >= 4 && units <= 5) {
    score += 4;
    signals.push(`${units} power units (mid-small fleet)`);
  }

  const mileage = parseInt(carrier.mcs150_mileage || "0", 10);
  if (mileage > 100000) {
    score += 15;
    signals.push(`High activity (${(mileage / 1000).toFixed(0)}K miles/year)`);
    analysis.push("Very active carrier — likely running loads regularly");
  } else if (mileage > 50000) {
    score += 10;
    signals.push(`Moderate activity (${(mileage / 1000).toFixed(0)}K miles/year)`);
  } else if (mileage > 10000) {
    score += 5;
    signals.push(`Low activity (${(mileage / 1000).toFixed(0)}K miles/year)`);
  } else if (mileage > 0) {
    score += 2;
    analysis.push("Minimal mileage reported — may be new or part-time");
  } else {
    score -= 5;
    disqualifiers.push("No mileage reported — may be inactive or paper-only carrier");
  }

  const mcs150Date = carrier.mcs150_date?.toString().substring(0, 8);
  if (mcs150Date) {
    const updateYear = parseInt(mcs150Date.substring(0, 4), 10);
    const yearsSinceUpdate = new Date().getFullYear() - updateYear;
    if (yearsSinceUpdate <= 1) {
      score += 10;
      signals.push("MCS-150 updated within 1 year (actively managed)");
    } else if (yearsSinceUpdate <= 2) {
      score += 5;
    } else {
      score -= 5;
      disqualifiers.push(`MCS-150 not updated in ${yearsSinceUpdate} years — may be inactive`);
    }
  }

  let contactScore = 0;
  if (carrier.phone && carrier.phone.length >= 10) {
    contactScore += 10;
    signals.push("Phone number available");
  }
  if (
    carrier.email_address &&
    carrier.email_address.includes("@") &&
    !carrier.email_address.includes("example")
  ) {
    contactScore += 10;
    signals.push("Email address available (direct outreach possible)");
  } else if (carrier.email_address && carrier.email_address.includes("example")) {
    disqualifiers.push("Placeholder email only");
  }
  score += contactScore;
  if (contactScore === 0) {
    score -= 15;
    disqualifiers.push("No phone or email — cannot contact");
  }

  const addDate = carrier.add_date?.toString().substring(0, 8);
  if (addDate) {
    const regYear = parseInt(addDate.substring(0, 4), 10);
    const yearsInOp = new Date().getFullYear() - regYear;
    if (yearsInOp >= 3) {
      score += 10;
      signals.push(`${yearsInOp} years in operation (established)`);
    } else if (yearsInOp >= 1) {
      score += 5;
      signals.push(`${yearsInOp} year(s) in operation`);
    } else {
      score += 2;
      analysis.push("New carrier — less track record");
    }
  }

  if (carrier.dba_name && carrier.dba_name !== carrier.legal_name && carrier.dba_name !== "None") {
    score += 5;
    signals.push(`DBA: ${carrier.dba_name} (branded business)`);
  }

  if (disqualifiers.length > 0) {
    analysis.push(`Concerns: ${disqualifiers.join("; ")}`);
  }

  score = Math.max(0, Math.min(100, score));
  if (disqualifiers.some((d) => d.includes("inactive") || d.includes("cannot contact"))) {
    score = Math.min(score, 45);
  }

  return { score, signals, analysis };
}

function getLanesForState(state: string | undefined): string[] {
  const lanes: Record<string, string[]> = {
    TX: ["TX-LA", "TX-CA", "TX-GA", "TX-TN", "Regional TX"],
    LA: ["TX-LA", "LA-TX", "Gulf Coast"],
    CA: ["TX-CA", "CA-TX", "West Coast"],
    GA: ["TX-GA", "GA-TN", "Southeast"],
    TN: ["TX-TN", "TN-GA", "Mid-South"],
  };
  return (state && lanes[state]) || [];
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  const maxResults = parseInt(process.env.FMCSA_MAX_RESULTS || "30", 10);
  const targetStates = (process.env.FMCSA_TARGET_STATES || "TX,LA,CA,GA,TN")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const appToken = process.env.SOCRATA_APP_TOKEN || "";

  const now = new Date();

  try {
    const client = await clientPromise;
    const db = client.db();

    // Exclude DOT numbers we already have.
    const existingDOTArray = await db
      .collection("outbound_prospects")
      .distinct("dotNumber");
    const existingDOTs = new Set<string>(existingDOTArray.filter(Boolean) as string[]);

    const perState = Math.ceil(maxResults / targetStates.length) + 10;
    const allCarriers: CensusCarrier[] = [];
    for (const state of targetStates) {
      const carriers = await queryCarriersByState(state, perState, existingDOTs, appToken);
      allCarriers.push(...carriers);
      await sleep(250); // rate-limit between states
    }

    // Score, rank, take top N.
    const scored = allCarriers.map((c) => {
      const { score, signals, analysis } = scoreCarrier(c);
      return { ...c, aiScore: score, interestSignals: signals, aiAnalysis: analysis.join("; ") };
    });
    scored.sort((a, b) => b.aiScore - a.aiScore);
    const topProspects = scored.slice(0, maxResults);

    const enriched = topProspects.map((c, i) => ({
      id: `fmcsa_${Date.now()}_${i}`,
      name: c.legal_name,
      dbaName: c.dba_name || null,
      contact: {
        phone: c.phone || null,
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
      interestSignals: c.interestSignals,
      source: "fmcsa_census_api",
      sourceUrl: `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dot_number}`,
      aiScore: c.aiScore,
      aiAnalysis:
        c.aiAnalysis ||
        "Real FMCSA-verified carrier — active, authorized for hire, general freight",
      status: c.aiScore >= 75 ? "qualified" : "new",
      type: "outbound_driver",
      dotNumber: c.dot_number,
      classdef: c.classdef,
      powerUnits: parseInt(c.power_units || "0", 10),
      drivers: parseInt(c.total_drivers || "0", 10),
      interstate: c.interstate_beyond_100_miles === "1",
      createdAt: now.toISOString(),
      enrichedAt: now.toISOString(),
    }));

    // Insert only DOT numbers still absent (re-check right before write).
    let savedCount = 0;
    if (enriched.length > 0) {
      const existing = await db
        .collection("outbound_prospects")
        .find({ dotNumber: { $in: enriched.map((e) => e.dotNumber) } })
        .project({ dotNumber: 1 })
        .toArray();
      const alreadySaved = new Set(existing.map((e) => e.dotNumber));
      const newProspects = enriched.filter((e) => !alreadySaved.has(e.dotNumber));
      if (newProspects.length > 0) {
        const result = await db.collection("outbound_prospects").insertMany(newProspects);
        savedCount = result.insertedCount;
      }
    }

    const qualifiedCount = topProspects.filter((c) => c.aiScore >= 75).length;

    // Heartbeat for the cron monitor -- same action name the laptop job used.
    await db.collection("agent_activity").insertOne({
      action: "fmcsa_prospecting",
      agent: SOFIA,
      result: {
        carriersFound: allCarriers.length,
        qualified: qualifiedCount,
        saved: savedCount,
        targetStates,
        dataSource: "FMCSA Company Census API (data.transportation.gov)",
        source: "vercel-cron",
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({
      ok: true,
      report: {
        carriersFound: allCarriers.length,
        qualified: qualifiedCount,
        saved: savedCount,
        targetStates,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/prospecting] Fatal error:", error);

    // Best-effort failure log so a stall is visible in the cron monitor.
    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "fmcsa_prospecting",
        agent: SOFIA,
        result: { error: message, source: "vercel-cron" },
        success: false,
        createdAt: new Date(),
        timestamp: new Date(),
      });
    } catch {
      // DB unreachable -- nothing more we can do.
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
