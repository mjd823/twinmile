import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/session";
import { pingIndexNow } from "@/lib/indexnow";
import { SITE_CONFIG } from "@/lib/site-config";
import {
  getBlogPostById,
  publishBlogPost,
  rejectBlogPost,
  updateBlogPost,
  type BlogPostEdits,
} from "@/lib/blog-store";

/**
 * Review actions for a single pipeline blog post.
 *
 * GET   — full post (draft content for the editor)
 * PATCH — { action: "update", title?, description?, sections?, needsWork? }
 *         { action: "publish" } → status published + IndexNow ping
 *         { action: "reject" }  → status rejected (kept for audit, never public)
 *
 * Auth: x-cron-secret header OR admin session — same dual-auth shape as the
 * other /api/admin/* routes.
 */

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  if (secret && headerSecret === secret) return true;
  return (await requireRole("admin")) !== null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const post = await getBlogPostById(id);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post: { ...post, _id: String(post._id) } });
  } catch (error) {
    console.error("[admin/blog/:id] GET failed:", error);
    return NextResponse.json({ error: "Failed to load post" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === "publish") {
      const post = await publishBlogPost(id);
      if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
      // Instant-indexing ping — fire-and-forget, never throws.
      await pingIndexNow([
        `${SITE_CONFIG.appUrl}/blog/${post.slug}`,
        `${SITE_CONFIG.appUrl}/blog`,
        `${SITE_CONFIG.appUrl}/sitemap.xml`,
      ]);
      return NextResponse.json({ post: { ...post, _id: String(post._id) } });
    }

    if (action === "reject") {
      const post = await rejectBlogPost(id);
      if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ post: { ...post, _id: String(post._id) } });
    }

    if (action === "update") {
      const edits: BlogPostEdits = {
        title: body?.title,
        description: body?.description,
        sections: body?.sections,
        needsWork: typeof body?.needsWork === "boolean" ? body.needsWork : undefined,
      };
      const post = await updateBlogPost(id, edits);
      if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ post: { ...post, _id: String(post._id) } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[admin/blog/:id] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}
