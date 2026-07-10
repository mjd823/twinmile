import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";
import {
  composeOutreachEmail,
  composePersistedEmailHtml,
} from "@/lib/outreach-templates";

/**
 * GET /api/admin/outreach/preview?taskId=<id>
 *
 * Returns { ok, subject, html, text, source } for one outreach task — the
 * full branded HTML document exactly as (or as it would be) delivered:
 *
 *  - source "persisted": the task carries renderedSubject/renderedHtml saved
 *    at send time. Tasks sent after the branded composer shipped store the
 *    complete document; earlier persisted tasks stored the bare fragment, so
 *    we wrap that EXACT fragment in the branded layout for display.
 *  - source "recomposed": legacy tasks with nothing persisted are re-rendered
 *    from the deterministic template + the personalization snapshot via the
 *    SAME composer the cron sends with.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
    }

    const taskId = request.nextUrl.searchParams.get("taskId") || "";
    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({ ok: false, error: "Invalid taskId" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const task = await db.collection("outreach_tasks").findOne({ _id: new ObjectId(taskId) });
    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    let subject = "";
    let html = "";
    let text = "";
    let source: "persisted" | "recomposed" | "unavailable" = "unavailable";

    if (task.renderedSubject || task.renderedHtml) {
      subject = task.renderedSubject || "";
      text = task.renderedBody || "";
      const stored = String(task.renderedHtml || "");
      html = composePersistedEmailHtml(
        task.template,
        subject,
        stored || `<pre style="white-space:pre-wrap;font-family:inherit;">${text}</pre>`,
        task.personalization
      );
      source = "persisted";
    } else {
      // Legacy task — recompose via the SAME composer the cron sends with.
      try {
        const pseudoLead = { name: task.leadName, ...(task.personalization || {}) };
        const composed = composeOutreachEmail(task.template, pseudoLead, task.personalization || {});
        subject = composed.subject;
        html = composed.html;
        text = composed.text;
        source = "recomposed";
      } catch {
        source = "unavailable";
      }
    }

    return NextResponse.json({ ok: true, subject, html, text, source });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/outreach/preview] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
