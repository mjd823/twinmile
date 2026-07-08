import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { SOFIA } from "@/lib/fmcsa-prospecting-core";
import { runProspectPriorities } from "@/lib/fmcsa-motus";

/**
 * GET /api/cron/prospect-priorities
 *
 * Sofia's nightly new-authority + insurance-lapse prioritizer (lib/fmcsa-motus.ts):
 * pulls carriers granted authority in the last 60 days (FMCSA Company Census
 * add_date) in TX/LA/OK/AR/NM plus the Motus Carrier daily-diff insurance
 * dataset (nakq-58th, fallback inys-ebih), flags missing/lapsed BIPD
 * insurance, and merge-dedupes into outbound_prospects by DOT with
 * priorityScore boosts (+20 new-authority, +15 insurance-lapse) and
 * sourceTags. Downstream, onboarding invites and the admin lead engine order
 * by priorityScore first.
 *
 * ALWAYS logs a run record to agent_activity (action: "prospect_priorities",
 * agent: Sofia Rodriguez) with real per-source counts — 0s included.
 *
 * Schedule (vercel.json): "0 9 * * *" UTC = 4AM CDT / 3AM CST nightly, after
 * the Motus daily diff refreshes and before Sofia's 13:00 UTC census run.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  if (!clientPromise) {
    return NextResponse.json(
      { ok: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const report = await runProspectPriorities(db);
    const now = new Date();

    await db.collection("agent_activity").insertOne({
      action: "prospect_priorities",
      agent: SOFIA,
      result: {
        states: report.states,
        windowDays: report.windowDays,
        motusSource: report.motusSource,
        newAuthorityFound: report.newAuthorityFound,
        insuranceLapseFound: report.insuranceLapseFound,
        bothSignals: report.bothSignals,
        inserted: report.inserted,
        updated: report.updated,
        insertedByTag: report.insertedByTag,
        skippedNoCensusMatch: report.skippedNoCensusMatch,
        dataSource:
          "FMCSA Motus Carrier (nakq-58th/inys-ebih) + Company Census (az4n-8mr2)",
        source: "vercel-cron",
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/prospect-priorities] Fatal error:", error);

    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "prospect_priorities",
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
