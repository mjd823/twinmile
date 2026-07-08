import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { Resend } from "resend";
import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

/**
 * POST /api/admin/outreach/send-reply
 *
 * Admin-only one-click send of the suggested response draft attached to an
 * inbound reply (outreach_replies.draftResponse). Body:
 *   { replyId: string, subject?: string, text?: string, html?: string }
 * subject/text/html override the stored draft when provided (edited before
 * send). Marks the reply "responded" and logs agent_activity
 * "prospect_reply_sent" (Marcus Chen).
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const replyId = String(body.replyId || "");
    if (!ObjectId.isValid(replyId)) {
      return NextResponse.json({ ok: false, error: "Invalid replyId" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const reply = await db.collection("outreach_replies").findOne({ _id: new ObjectId(replyId) });
    if (!reply) {
      return NextResponse.json({ ok: false, error: "Reply not found" }, { status: 404 });
    }
    if (reply.responseSentAt) {
      return NextResponse.json(
        { ok: false, error: "A response was already sent for this reply" },
        { status: 409 }
      );
    }

    const to = String(reply.fromEmail || "").trim();
    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Reply has no sender email to respond to" },
        { status: 400 }
      );
    }

    const draft = reply.draftResponse || {};
    const subject = String(body.subject || draft.subject || "Re: Drive with Twin Mile");
    const text = String(body.text || draft.text || "");
    const html = String(body.html || draft.html || "");
    if (!text && !html) {
      return NextResponse.json(
        { ok: false, error: "No draft content to send — provide text or html" },
        { status: 400 }
      );
    }

    const resend = new Resend(RESEND_API_KEY);
    const FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const REPLY_TO =
      process.env.OUTREACH_REPLY_TO || process.env.RESEND_NOTIFY_TO || "admin@twinmile.com";

    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      replyTo: REPLY_TO,
      html: html || undefined,
      text: text || html.replace(/<[^>]+>/g, " "),
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Resend send failed" },
        { status: 502 }
      );
    }

    const now = new Date();
    await db.collection("outreach_replies").updateOne(
      { _id: reply._id },
      {
        $set: {
          status: "responded",
          responseSentAt: now,
          responseResendId: data?.id || null,
          responseSentBy: user.email,
          responseSubject: subject,
          responseText: text,
          responseHtml: html,
        },
      }
    );

    await db.collection("agent_activity").insertOne({
      agent: { name: "Marcus Chen", role: "Sales Director", department: "Sales" },
      action: "prospect_reply_sent",
      activity: `Replied to ${reply.fromName || to}: "${subject.slice(0, 80)}"`,
      type: "outreach",
      result: {
        replyId: reply._id.toString(),
        to,
        subject,
        sentBy: user.email,
        resendId: data?.id || null,
      },
      success: true,
      createdAt: now,
      timestamp: now,
    });

    return NextResponse.json({ ok: true, resendId: data?.id || null, sentAt: now.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/outreach/send-reply] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
