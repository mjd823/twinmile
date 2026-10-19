import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { checkCronAuth } from "@/lib/cron-auth";
import { drainQuoteIntake, quoteIntakeHealth } from "@/lib/quote-intake";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  if (!clientPromise) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const db = (await clientPromise).db();
    const result = await drainQuoteIntake(db);
    const backlog = await quoteIntakeHealth(db);
    await db.collection<{ _id: string }>("agent_activity").updateOne({ _id: "quote-intake-heartbeat" }, { $set: {
      action: "quote_intake_recovery", agentName: "Quote Intake", success: backlog.attention === 0 && backlog.pending === 0,
      result, backlog, createdAt: new Date(), timestamp: new Date(),
    } }, { upsert: true });
    return NextResponse.json({ ...result, backlog });
  } catch {
    return NextResponse.json({ error: "Quote intake recovery failed" }, { status: 503 });
  }
}
