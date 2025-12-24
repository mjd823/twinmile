import { NextResponse } from "next/server";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { createUser } from "@/lib/auth/users";

const BootstrapSchema = z.object({
  token: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(12).max(200),
});

export async function POST(req: Request) {
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
  if (!expected || parsed.data.token !== expected) {
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
