import { NextRequest, NextResponse } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { generateDailyPack } from "@/lib/social/generate-pack";
import { pingIndexNow } from "@/lib/indexnow";

/**
 * Daily recruiting post pack cron (13:45 UTC — see vercel.json).
 *
 * Rotates deterministically through the honest recruiting angles
 * (lib/social/post-pack.ts), saves captions + render fields to the
 * `socialPacks` collection, and exposes images via the on-demand
 * /api/social-image route. Idempotent per UTC day; pass ?force=1 to rebuild.
 *
 * Auth: shared checkCronAuth guard (x-cron-secret header or Vercel Cron's
 * Authorization bearer).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await generateDailyPack({ force });

    // Daily IndexNow ping of the sitemap keeps Bing/Yandex fresh; cheap,
    // fire-and-forget, never throws.
    await pingIndexNow(["https://twinmile.com/sitemap.xml"]);

    return NextResponse.json({
      ok: true,
      created: result.created,
      date: result.date,
      ...(result.reason ? { reason: result.reason } : {}),
      items: result.pack?.items.length ?? 0,
      pack: result.pack,
    });
  } catch (error) {
    console.error("[cron/social-pack] Cron failed:", error);
    return NextResponse.json({ ok: false, error: "Cron failed" }, { status: 500 });
  }
}
