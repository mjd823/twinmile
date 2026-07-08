import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { SOFIA } from "@/lib/fmcsa-prospecting-core";
import { generateCallSheet } from "@/lib/call-sheet";

/**
 * GET /api/cron/call-sheet
 *
 * Sofia's daily call sheet builder (lib/call-sheet.ts): selects 20 phone-only
 * prospects (phone present, email absent, never on a sheet, not DNC),
 * generates an honest per-carrier call script from the VERIFIED pay copy, and
 * stores the sheet in `callSheets` for the mobile-first /admin/call-sheet
 * page. A HUMAN dials — no autodialer, no AI voice; the dncList collection is
 * honored on selection and the admin page has one-tap Mark Called / Mark DNC.
 *
 * Idempotent per UTC day; pass ?force=1 to rebuild today's sheet.
 *
 * ALWAYS logs a run record to agent_activity (action: "call_sheet",
 * agent: Sofia Rodriguez) with real counts per source.
 *
 * Schedule (vercel.json): "30 13 * * *" UTC = 8:30AM CDT daily, before the
 * 9am recipient-local call window opens anywhere in the target states.
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

    const force = request.nextUrl.searchParams.get("force") === "1";
    const report = await generateCallSheet(db, { force });
    const now = new Date();

    await db.collection("agent_activity").insertOne({
      action: "call_sheet",
      agent: SOFIA,
      result: {
        date: report.date,
        created: report.created,
        selected: report.selected,
        skippedDnc: report.skippedDnc,
        bySource: report.bySource,
        ...(report.reason ? { reason: report.reason } : {}),
        compliance: "human-dials-only; dncList honored on selection",
        source: "vercel-cron",
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({
      ok: true,
      date: report.date,
      created: report.created,
      selected: report.selected,
      skippedDnc: report.skippedDnc,
      bySource: report.bySource,
      ...(report.reason ? { reason: report.reason } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/call-sheet] Fatal error:", error);

    try {
      const client = await clientPromise;
      await client.db().collection("agent_activity").insertOne({
        action: "call_sheet",
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
