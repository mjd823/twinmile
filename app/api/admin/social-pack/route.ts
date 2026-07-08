import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/session";
import { generateDailyPack, listPacks } from "@/lib/social/generate-pack";

/**
 * Admin/hub access to daily recruiting post packs.
 *
 * GET  — latest packs (?limit=N, default 7, max 30)
 * POST — generate/regenerate today's pack on demand ({ "force": true } body
 *        to rebuild an existing pack)
 *
 * Auth: x-cron-secret header (hub/automation) OR an admin session cookie.
 * Same dual-auth shape as jaelynnsfashion's /api/admin/social-pack so the
 * hub can consume every business with one pattern.
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

    const rawLimit = Number(request.nextUrl.searchParams.get("limit")) || 7;
    const limit = Math.min(Math.max(rawLimit, 1), 30);

    const packs = await listPacks(limit);
    return NextResponse.json({ packs });
  } catch (error) {
    console.error("[admin/social-pack] GET failed:", error);
    return NextResponse.json({ error: "Failed to load social packs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    const result = await generateDailyPack({ force });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/social-pack] POST failed:", error);
    return NextResponse.json({ error: "Failed to generate social pack" }, { status: 500 });
  }
}
