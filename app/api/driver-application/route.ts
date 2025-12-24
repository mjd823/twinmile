import { NextResponse } from "next/server";

import clientPromise from "@/lib/mongodb";
import { DriverLeadSchema } from "@/lib/leads";
import { getClientIp } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: `lead:driver:ip:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  if (!clientPromise) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = DriverLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again." },
      { status: 400 }
    );
  }

  if (parsed.data.hp && parsed.data.hp.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const client = await clientPromise;
  const db = client.db();

  await db.collection("leads_drivers").insertOne({
    ...parsed.data,
    hp: undefined,
    createdAt: new Date(),
    source: "web",
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
