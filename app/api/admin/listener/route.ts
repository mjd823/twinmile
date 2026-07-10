import { NextRequest, NextResponse } from "next/server";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { parsePage } from "@/lib/paginate";
import {
  listListenerLeads,
  runSocialListener,
  setListenerLeadStatus,
} from "@/lib/social-listener";

/**
 * Admin access to Sofia the Listener's surfaced Reddit conversations.
 *
 * GET  — newest-first paginated leads with a real countDocuments total
 *        (?page=N, ?status=new|replied|dismissed|all)
 * POST — one of:
 *   { "scan": true }                                 run the listener now
 *   { "postId", "action": "replied" | "dismissed" }  one-tap status flip
 *
 * Auth: x-cron-secret header (hub/automation) OR an admin session cookie —
 * same dual-auth shape as /api/admin/call-sheet.
 *
 * Read-only listening: this API never posts to Reddit. Status flips only
 * record what MJ did manually.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

    const page = parsePage(request.nextUrl.searchParams.get("page"));
    const status = request.nextUrl.searchParams.get("status") || "all";

    const client = await clientPromise;
    const { rows, ...meta } = await listListenerLeads(client.db(), { page, status });
    return NextResponse.json({ leads: rows, ...meta });
  } catch (error) {
    console.error("[admin/listener] GET failed:", error);
    return NextResponse.json({ error: "Failed to load listener leads" }, { status: 500 });
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

    if (body?.scan === true) {
      const report = await runSocialListener(db);
      return NextResponse.json({ ok: true, ...report });
    }

    const postId = typeof body?.postId === "string" ? body.postId : "";
    const action = body?.action;
    if (!postId || (action !== "replied" && action !== "dismissed" && action !== "new")) {
      return NextResponse.json(
        { error: "Expected { postId, action: 'replied' | 'dismissed' } or { scan: true }" },
        { status: 400 }
      );
    }

    const updated = await setListenerLeadStatus(db, postId, action);
    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/listener] POST failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
