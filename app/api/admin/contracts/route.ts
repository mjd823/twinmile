import { NextResponse } from "next/server";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateContractSchema = z.object({
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  name: z.string().min(1).max(140),
  rateUsd: z.coerce.number().min(0).max(100000000).default(0),
  rateType: z.enum(["flat", "per_mile", "hourly"]).default("flat"),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const client = await clientPromise;
  const db = client.db();

  const contracts = await db
    .collection("contracts")
    .find({}, { sort: { createdAt: -1 }, limit: 500 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      contracts: contracts.map((c: any) => ({
        id: String(c._id),
        customerId: c.customerId ? String(c.customerId) : "",
        name: String(c.name ?? ""),
        rateType: String(c.rateType ?? "flat"),
        rateUsd: Number(c.rateUsd ?? 0),
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
  const parsed = CreateContractSchema.safeParse(body);
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
    customerId: parsed.data.customerId,
    name: parsed.data.name,
    rateType: parsed.data.rateType,
    rateUsd: parsed.data.rateUsd,
    notes: parsed.data.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("contracts").insertOne(doc);

  return NextResponse.json({ ok: true, contractId: String(result.insertedId) }, { status: 200 });
}
