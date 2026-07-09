import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/session";
import { generateBlogDraft } from "@/lib/blog-generate";
import { listBlogPosts } from "@/lib/blog-store";

/**
 * Admin access to the auto-blog pipeline.
 *
 * GET  — list pipeline posts, all statuses (?limit=N, default 50, max 100)
 * POST — generate a new draft on demand ({ "force": true } to bypass the
 *        cadence guard, optional { "topicId" } to pick a specific topic)
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

    const rawLimit = Number(request.nextUrl.searchParams.get("limit")) || 50;
    const limit = Math.min(Math.max(rawLimit, 1), 100);

    const posts = await listBlogPosts(limit);
    return NextResponse.json({
      posts: posts.map((p) => ({ ...p, _id: String(p._id) })),
    });
  } catch (error) {
    console.error("[admin/blog] GET failed:", error);
    return NextResponse.json({ error: "Failed to load blog posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await generateBlogDraft({
      force: body?.force === true,
      topicId: typeof body?.topicId === "string" ? body.topicId : undefined,
    });

    return NextResponse.json({
      ...result,
      ...(result.post ? { post: { ...result.post, _id: String(result.post._id) } } : {}),
    });
  } catch (error) {
    console.error("[admin/blog] POST failed:", error);
    return NextResponse.json({ error: "Failed to generate blog draft" }, { status: 500 });
  }
}
