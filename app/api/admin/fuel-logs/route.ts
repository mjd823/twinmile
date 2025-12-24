import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateFuelLogSchema = z.object({
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  at: z.string().datetime().optional(),
  gallons: z.coerce.number().min(0).max(10000).default(0),
  costUsd: z.coerce.number().min(0).max(100000000).default(0),
  odometer: z.coerce.number().min(0).max(100000000).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const client = await clientPromise;
  const db = client.db();

  const logs = await db
    .collection("fuelLogs")
    .find({}, { sort: { at: -1 }, limit: 500 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      fuelLogs: logs.map((l: any) => ({
        id: String(l._id),
        truckId: l.truckId ? String(l.truckId) : "",
        at: l.at instanceof Date ? l.at.toISOString() : "",
        gallons: Number(l.gallons ?? 0),
        costUsd: Number(l.costUsd ?? 0),
        odometer: typeof l.odometer === "number" ? l.odometer : null,
        notes: l.notes ? String(l.notes) : "",
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
  const parsed = CreateFuelLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  const at = parsed.data.at ? new Date(parsed.data.at) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid at timestamp." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  let truckObjectId: ObjectId;
  try {
    truckObjectId = new ObjectId(parsed.data.truckId);
  } catch {
    return NextResponse.json({ error: "Invalid truckId." }, { status: 400 });
  }

  const doc = {
    truckId: parsed.data.truckId,
    at,
    gallons: parsed.data.gallons,
    costUsd: parsed.data.costUsd,
    odometer: parsed.data.odometer,
    notes: parsed.data.notes,
    createdAt: new Date(),
  };

  const result = await db.collection("fuelLogs").insertOne(doc);

  await db
    .collection("trucks")
    .updateOne({ _id: truckObjectId }, { $set: { updatedAt: new Date() } })
    .catch(() => {
      // ignore
    });

  return NextResponse.json({ ok: true, fuelLogId: String(result.insertedId) }, { status: 200 });
}
