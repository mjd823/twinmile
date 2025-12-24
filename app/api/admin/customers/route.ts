import { NextResponse } from "next/server";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(140),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const client = await clientPromise;
  const db = client.db();

  const customers = await db
    .collection("customers")
    .find({}, { sort: { name: 1 }, limit: 500 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      customers: customers.map((c: any) => ({
        id: String(c._id),
        name: String(c.name ?? ""),
        contactEmail: c.contactEmail ? String(c.contactEmail) : "",
        contactPhone: c.contactPhone ? String(c.contactPhone) : "",
        notes: c.notes ? String(c.notes) : "",
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : "",
      })),
    },
    { status: 200, headers: { "cache-control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = CreateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db();

  const doc = {
    name: parsed.data.name,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone,
    notes: parsed.data.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("customers").insertOne(doc);

  return NextResponse.json({ ok: true, customerId: String(result.insertedId) }, { status: 200 });
}
