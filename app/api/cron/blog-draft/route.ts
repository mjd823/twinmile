import { NextRequest, NextResponse } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { generateBlogDraft } from "@/lib/blog-generate";

/**
 * Weekly auto-blog draft cron (Mondays 15:00 UTC — see vercel.json).
 *
 * Generates ONE draft for the trucking/owner-operator audience with
 * HTTP-verified .gov citations (lib/blog-generate.ts) and stores it in the
 * `blogPosts` collection with status "draft". Nothing goes live from here —
 * a human reviews and publishes in /admin/blog.
 *
 * Conservative cadence: skips if an unreviewed draft exists or a post was
 * generated in the last 6 days. Pass ?force=1 to override.
 *
 * Auth: shared checkCronAuth guard (x-cron-secret header or Vercel Cron's
 * Authorization bearer) — same pattern as every other cron route.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await generateBlogDraft({ force });

    return NextResponse.json({
      ok: true,
      created: result.created,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.post
        ? {
            draft: {
              id: String(result.post._id),
              slug: result.post.slug,
              title: result.post.title,
              status: result.post.status,
              needsWork: result.post.needsWork,
              reviewNotes: result.post.reviewNotes,
              citations: result.post.citations.length,
              wordCount: result.post.wordCount,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("[cron/blog-draft] Cron failed:", error);
    return NextResponse.json({ ok: false, error: "Cron failed" }, { status: 500 });
  }
}
