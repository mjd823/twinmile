import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";
import {
  CENSUS_API,
  scoreCarrier,
  type CensusCarrier,
} from "@/lib/fmcsa-prospecting-core";
import { QUALIFIED_SCORE_THRESHOLD } from "@/lib/pipeline-stages";

/**
 * POST /api/admin/rescore-prospects
 * Body: { limit?: number }   (default 50, max 100)
 *
 * REAL re-score for the below-75 bucket. scoreCarrier() is deterministic on
 * FMCSA fields, so re-running it on stale data would return the same number —
 * a meaningful re-score must re-FETCH each carrier's CURRENT record from the
 * FMCSA Company Census API (contact info, power units, MCS-150 recency all
 * change over time; the "cannot contact" score cap lifts if a phone/email
 * appears). Every pass is recorded in scoreHistory + rescoredAt, and a
 * prospect whose fresh score crosses the threshold is promoted to
 * "qualified" — the same status the invite cron consumes.
 *
 * Prospects that have vanished from the census (deregistered carriers) are
 * marked, not silently skipped.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOFIA = {
  name: "Sofia Rodriguez",
  role: "Lead Generation Specialist",
  department: "Sales",
};

async function fetchCarriersByDot(
  dotNumbers: string[]
): Promise<Map<string, CensusCarrier>> {
  const map = new Map<string, CensusCarrier>();
  if (dotNumbers.length === 0) return map;

  const select =
    "dot_number,legal_name,dba_name,phy_city,phy_state,phy_zip,phone,power_units,total_drivers,classdef,email_address,carrier_operation,interstate_beyond_100_miles,hm_ind,mcs150_date,mcs150_mileage,add_date";
  const quoted = dotNumbers.map((d) => `'${String(d).replace(/[^0-9]/g, "")}'`).join(",");
  const params = new URLSearchParams({
    $select: select,
    $where: `dot_number in(${quoted})`,
    $limit: String(dotNumbers.length + 5),
  });
  const appToken = process.env.SOCRATA_APP_TOKEN || "";
  if (appToken) params.append("$$app_token", appToken);

  const res = await fetch(`${CENSUS_API}?${params.toString()}`, {
    headers: {
      "User-Agent": "TwinMile-Prospecting/1.0",
      Accept: "application/json",
      ...(appToken ? { "X-App-Token": appToken } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`FMCSA Census API error: ${res.status}`);
  }
  const rows: CensusCarrier[] = await res.json();
  for (const row of rows) map.set(String(row.dot_number), row);
  return map;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const bearer = request.headers.get("authorization");
    const cronOk =
      !!process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`;
    if (!cronOk && (!user || user.role !== "admin")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!clientPromise) {
      return NextResponse.json(
        { ok: false, error: "Database not configured" },
        { status: 500 }
      );
    }

    let limit = 50;
    try {
      const body = await request.json();
      if (typeof body?.limit === "number") limit = body.limit;
    } catch {
      // empty body is fine
    }
    limit = Math.max(1, Math.min(100, Math.floor(limit)));

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    // The below-75 bucket (same definition as lib/pipeline-stages), never- or
    // longest-ago-rescored first so repeated clicks work through the backlog.
    const targets = await db
      .collection("outbound_prospects")
      .find({
        $or: [{ status: "new" }, { status: { $exists: false } }],
        $nor: [{ aiScore: { $gte: QUALIFIED_SCORE_THRESHOLD } }],
        dotNumber: { $exists: true, $nin: [null, ""] },
      })
      .sort({ rescoredAt: 1, createdAt: 1 })
      .limit(limit)
      .project({ dotNumber: 1, aiScore: 1, status: 1, name: 1 })
      .toArray();

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        rescored: 0,
        newlyQualified: 0,
        scoreChanged: 0,
        notFound: 0,
        message: "No below-75 prospects with a DOT number to re-score.",
      });
    }

    const fresh = await fetchCarriersByDot(targets.map((t) => String(t.dotNumber)));

    let newlyQualified = 0;
    let scoreChanged = 0;
    let notFound = 0;

    const bulk = db.collection("outbound_prospects").initializeUnorderedBulkOp();
    for (const t of targets) {
      const carrier = fresh.get(String(t.dotNumber));
      const previousScore = typeof t.aiScore === "number" ? t.aiScore : 0;

      if (!carrier) {
        notFound += 1;
        bulk.find({ _id: t._id }).updateOne({
          $set: {
            rescoredAt: now,
            aiAnalysis:
              "Not found in the FMCSA Company Census on re-score — carrier may have deregistered or gone inactive.",
          },
          $push: {
            scoreHistory: {
              score: previousScore,
              previousScore,
              at: now,
              source: "fmcsa_rescore",
              notFound: true,
            },
          } as never,
        });
        continue;
      }

      const { score, signals, analysis } = scoreCarrier(carrier);
      if (score !== previousScore) scoreChanged += 1;
      const promoted =
        score >= QUALIFIED_SCORE_THRESHOLD && (t.status === "new" || !t.status);
      if (promoted) newlyQualified += 1;

      bulk.find({ _id: t._id }).updateOne({
        $set: {
          aiScore: score,
          interestSignals: signals,
          aiAnalysis:
            analysis.join("; ") ||
            "Re-scored from current FMCSA Census data",
          "contact.phone": carrier.phone || null,
          "contact.email": carrier.email_address || null,
          powerUnits: parseInt(carrier.power_units || "0", 10),
          drivers: parseInt(carrier.total_drivers || "0", 10),
          rescoredAt: now,
          ...(promoted ? { status: "qualified" } : {}),
        },
        $push: {
          scoreHistory: {
            score,
            previousScore,
            at: now,
            source: "fmcsa_rescore",
          },
        } as never,
      });
    }
    await bulk.execute();

    const result = {
      rescored: targets.length,
      newlyQualified,
      scoreChanged,
      notFound,
      threshold: QUALIFIED_SCORE_THRESHOLD,
    };

    await db.collection("agent_activity").insertOne({
      action: "prospect_rescore",
      agent: SOFIA,
      result,
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rescore-prospects] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
