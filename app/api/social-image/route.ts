import { NextRequest, NextResponse } from "next/server";

import { getPackByDate } from "@/lib/social/generate-pack";
import {
  buildPostsForDate,
  todayDateString,
  POSTS_PER_PACK,
  type RecruitingPost,
} from "@/lib/social/post-pack";
import { renderRecruitingPostPng } from "@/lib/social/post-image";

/**
 * On-demand recruiting post image: GET /api/social-image?date=YYYY-MM-DD&slot=0|1
 *
 * Renders the 1080x1350 PNG for a pack slot. Prefers the stored socialPacks
 * doc (so the image always matches the saved captions); falls back to the
 * deterministic template derivation when no doc exists — rendering is a pure
 * function of (date, slot), so the fallback produces the identical image.
 *
 * Public by design: it serves marketing creative only (same content as the
 * public /drive-with-us page). Cached hard at the CDN since content for a
 * date never changes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const date = params.get("date") || todayDateString();
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
    }
    const slot = Number(params.get("slot") ?? "0");
    if (!Number.isInteger(slot) || slot < 0 || slot >= POSTS_PER_PACK) {
      return NextResponse.json({ error: `Invalid slot (0-${POSTS_PER_PACK - 1})` }, { status: 400 });
    }

    let post: RecruitingPost | null = null;
    try {
      const pack = await getPackByDate(date);
      const item = pack?.items.find((i) => i.slot === slot);
      if (item) {
        post = {
          slot: item.slot,
          angleId: item.angleId,
          headline: item.headline,
          sub: item.sub,
          bullets: item.bullets as [string, string, string],
          caption: item.caption,
        };
      }
    } catch {
      // DB unavailable — fall through to the deterministic derivation.
    }
    if (!post) {
      post = buildPostsForDate(date)[slot];
    }

    const png = await renderRecruitingPostPng(post);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Content-Disposition": `inline; filename="twinmile-social-${date}-${slot}.png"`,
      },
    });
  } catch (error) {
    console.error("[social-image] Render failed:", error);
    return NextResponse.json({ error: "Image render failed" }, { status: 500 });
  }
}
