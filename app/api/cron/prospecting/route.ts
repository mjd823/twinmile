import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { runFmcsaProspecting, SOFIA } from "@/lib/fmcsa-prospecting-core";

/**
 * GET /api/cron/prospecting
 *
 * Vercel cron port of scripts/fmcsa-prospecting.mjs -- Sofia Rodriguez's
 * daily FMCSA Company Census prospecting run (previously the laptop Hermes
 * job "Sofia — Outbound Prospecting", 8AM CT).
 *
 * Core logic lives in lib/fmcsa-prospecting-core.ts and is shared with the
 * on-demand "outbound_prospecting" admin action (agent dashboard button).
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

    const report = await runFmcsaProspecting(db);

    const now = new Date();

    // Heartbeat for the cron monitor -- same action name the laptop job used.
    await db.collection("agent_activity").insertOne({
      action: "fmcsa_prospecting",
      agent: SOFIA,
      result: {
        carriersFound: report.carriersFound,
        qualified: report.qualified,
        saved: report.saved,
        targetStates: report.targetStates,
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
        carriersFound: report.carriersFound,
        qualified: report.qualified,
        saved: report.saved,
        targetStates: report.targetStates,
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
