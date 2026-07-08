import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { generateCallSheet, listCallSheets } from "@/lib/call-sheet";

/**
 * Admin access to the daily phone-only call sheets.
 *
 * GET  — latest sheets (?limit=N, default 7, max 30)
 * POST — one of:
 *   { "generate": true, "force"?: true }           build/rebuild today's sheet
 *   { "date", "prospectId", "action": "called" }   one-tap mark called
 *   { "date", "prospectId", "action": "dnc" }      one-tap Do-Not-Call:
 *       flips the sheet item, adds phone+DOT to dncList (checked on every
 *       future selection), and sets the prospect status to do_not_call.
 *   (prospectId is the sheet-item key — some legacy prospects have no DOT
 *   number, so DOT is not a reliable identifier.)
 *
 * Auth: x-cron-secret header (hub/automation) OR an admin session cookie —
 * same dual-auth shape as /api/admin/social-pack.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  if (secret && headerSecret === secret) return true;
  return (await requireRole("admin")) !== null;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!clientPromise) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const rawLimit = Number(request.nextUrl.searchParams.get("limit")) || 7;
    const limit = Math.min(Math.max(rawLimit, 1), 30);

    const client = await clientPromise;
    const sheets = await listCallSheets(client.db(), limit);
    return NextResponse.json({ sheets });
  } catch (error) {
    console.error("[admin/call-sheet] GET failed:", error);
    return NextResponse.json({ error: "Failed to load call sheets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!clientPromise) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();
    const body = await request.json().catch(() => ({}));

    // On-demand generation (admin button).
    if (body?.generate === true) {
      const result = await generateCallSheet(db, { force: body?.force === true });
      return NextResponse.json(result);
    }

    const date = typeof body?.date === "string" ? body.date : "";
    const prospectId = typeof body?.prospectId === "string" ? body.prospectId : "";
    const action = body?.action;
    if (!date || !prospectId || (action !== "called" && action !== "dnc")) {
      return NextResponse.json(
        { error: "Expected { date, prospectId, action: 'called' | 'dnc' }" },
        { status: 400 }
      );
    }

    const sheet = await db.collection("callSheets").findOne({ date });
    if (!sheet) {
      return NextResponse.json({ error: `No call sheet for ${date}` }, { status: 404 });
    }
    const item = (sheet.items || []).find(
      (i: { prospectId: string }) => i.prospectId === prospectId
    );
    if (!item) {
      return NextResponse.json(
        { error: `Prospect ${prospectId} not on the ${date} sheet` },
        { status: 404 }
      );
    }

    const now = new Date();
    const newStatus = action === "dnc" ? "dnc" : "called";

    await db.collection("callSheets").updateOne(
      { date, "items.prospectId": prospectId },
      {
        $set: {
          "items.$.status": newStatus,
          "items.$.calledAt": now.toISOString(),
        },
      }
    );

    // Reflect on the prospect record.
    const prospectFilter = ObjectId.isValid(prospectId)
      ? { _id: new ObjectId(prospectId) }
      : { id: prospectId };

    if (action === "called") {
      await db.collection("outbound_prospects").updateOne(prospectFilter, {
        $set: { lastCalledAt: now.toISOString(), updatedAt: now },
      });
    } else {
      // Do-Not-Call: honored immediately and forever. Key by DOT when the
      // prospect has one, otherwise by phone (legacy rows can lack a DOT).
      const dncKey = item.dotNumber
        ? { dotNumber: item.dotNumber }
        : { phone: item.phone || "" };
      await db.collection("dncList").updateOne(
        dncKey,
        {
          $set: {
            dotNumber: item.dotNumber || "",
            phone: item.phone || "",
            name: item.name || "",
            reason: "Requested removal on call",
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      await db.collection("outbound_prospects").updateOne(prospectFilter, {
        $set: { status: "do_not_call", dncAt: now.toISOString(), updatedAt: now },
      });
    }

    return NextResponse.json({ ok: true, date, prospectId, status: newStatus });
  } catch (error) {
    console.error("[admin/call-sheet] POST failed:", error);
    return NextResponse.json({ error: "Call sheet action failed" }, { status: 500 });
  }
}
