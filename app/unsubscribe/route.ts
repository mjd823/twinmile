import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

/**
 * /unsubscribe — RFC 8058 one-click unsubscribe.
 *
 * Referenced by the List-Unsubscribe / List-Unsubscribe-Post headers on every
 * cold send (lib/sending-policy.ts). Two callers, both required:
 *
 *   POST — the mail client's one-click button. Fires with no user interaction
 *          and no session. Must succeed without a login and must actually
 *          suppress, because Gmail and Yahoo treat a header that does not work
 *          as worse than no header at all: it counts as a broken promise and
 *          pushes recipients toward the spam button instead.
 *   GET  — a human following the link. Same effect, plus a plain confirmation.
 *
 * Suppression is by EMAIL, not by token, so unsubscribing once removes the
 * person from every future sequence rather than just the one message they
 * happened to click.
 */

export const dynamic = "force-dynamic";

async function suppress(token: string): Promise<{ ok: boolean; email?: string }> {
  if (!clientPromise || !token) return { ok: false };
  const client = await clientPromise;
  const db = client.db();

  // The token is either an onboarding session token or an outreach task id.
  const session = await db.collection("onboarding_sessions").findOne({ rawToken: token });
  let email: string | undefined = session?.email;

  if (!email) {
    let taskId: ObjectId | null = null;
    try {
      taskId = new ObjectId(token);
    } catch {
      taskId = null;
    }
    if (taskId) {
      const task = await db.collection("outreach_tasks").findOne({ _id: taskId });
      email = task?.leadEmail;
    }
  }
  if (!email) return { ok: false };

  const now = new Date();
  const emailRegex = { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };

  await Promise.all([
    db.collection("suppressions").updateOne(
      { email: email.toLowerCase() },
      { $set: { email: email.toLowerCase(), reason: "one_click_unsubscribe", suppressedAt: now } },
      { upsert: true }
    ),
    db
      .collection("outbound_prospects")
      .updateMany({ email: emailRegex }, { $set: { status: "unsubscribed", updatedAt: now } }),
    db
      .collection("leads_drivers")
      .updateMany({ email: emailRegex }, { $set: { status: "unsubscribed", updatedAt: now } }),
    // Cancel anything already queued for this person — an unsubscribe that
    // still lets tomorrow's scheduled follow-up go out is the fastest route to
    // a spam complaint.
    db.collection("outreach_tasks").updateMany(
      { leadEmail: emailRegex, status: { $in: ["pending", "retrying", "drafted"] } },
      { $set: { status: "cancelled", cancelledReason: "recipient unsubscribed", updatedAt: now } }
    ),
    db.collection("agent_activity").insertOne({
      action: "unsubscribe",
      agent: { name: "Emily Watson", role: "Customer Success", department: "Revenue" },
      activity: `Unsubscribe honored for ${email}`,
      success: true,
      createdAt: now,
      timestamp: now,
    }),
  ]);

  return { ok: true, email };
}

export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const result = await suppress(token);
  // Always 200: a mail client retrying against an unknown token gains nothing,
  // and an error status here is read as a broken unsubscribe.
  return NextResponse.json({ ok: true, suppressed: result.ok });
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const result = await suppress(token);

  const message = result.ok
    ? `${result.email} has been removed. You will not receive further emails from Twin Mile.`
    : "This link is no longer valid. If you are still receiving emails, reply to any of them and we will remove you.";

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — Twin Mile</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#0f172a;line-height:1.6}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#475569}a{color:#2563eb}</style>
</head><body><h1>Unsubscribed</h1><p>${message}</p>
<p><a href="https://twinmile.com">twinmile.com</a></p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
