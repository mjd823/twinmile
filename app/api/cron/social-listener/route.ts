import { NextRequest, NextResponse } from "next/server";

import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { LISTENER_AGENT, runSocialListener } from "@/lib/social-listener";

/**
 * GET /api/cron/social-listener
 *
 * "Sofia the Listener" — reads public Reddit JSON (r/OwnerOperators,
 * r/Truckers, r/TruckDrivers) for owner-operators who are ALREADY asking for
 * help (lease-on questions, new-authority insurance pain, percentage-pay
 * questions), scores them, and stores surfaced items in `listener_leads`
 * with a drafted helpful reply for the /admin/listener page.
 *
 * BOUNDARIES: read-only public data; NO automated posting, commenting, or
 * DMs — a named human (MJ) reviews every item and posts replies personally.
 *
 * Logs an honest agent_activity run record as Sofia
 * (action: "social_listening", scanned N / surfaced M).
 *
 * Schedule (vercel.json): "15 STAR/6 * * *" UTC — every 6 hours (STAR = *,
 * which can't appear before a slash inside this comment).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

    const report = await runSocialListener(db);
    const now = new Date();

    await db.collection("agent_activity").insertOne({
      action: "social_listening",
      agent: LISTENER_AGENT,
      result: {
        scanned: report.scanned,
        surfaced: report.surfaced,
        inserted: report.inserted,
        rateLimited: report.rateLimited,
        compliance: "read-only public data; human posts every reply; no automated posting or DMs",
        source: "vercel-cron",
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/social-listener] Fatal error:", error);

    try {
      const client = await clientPromise;
      const now = new Date();
      await client.db().collection("agent_activity").insertOne({
        action: "social_listening",
        agent: LISTENER_AGENT,
        result: { error: message, source: "vercel-cron" },
        success: false,
        createdAt: now,
        timestamp: now,
      });
    } catch {
      // best-effort logging only
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
