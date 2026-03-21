import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { createUser } from "@/lib/auth/users";
import { getClientIp } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const BootstrapSchema = z.object({
  token: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(12).max(200),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit({
    key: `auth:bootstrap:ip:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  if (!clientPromise) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BootstrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const expected = process.env.BOOTSTRAP_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const a = Buffer.from(parsed.data.token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existingAdmin = await db.collection("users").findOne({ role: "admin" });
  if (existingAdmin) {
    return NextResponse.json(
      { error: "Admin already exists." },
      { status: 409 }
    );
  }

  const admin = await createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    role: "admin",
  });

  return NextResponse.json({ ok: true, adminEmail: admin.email }, { status: 200 });
}
