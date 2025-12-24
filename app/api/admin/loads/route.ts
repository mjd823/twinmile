import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateLoadSchema = z.object({
  status: z.enum(["planned", "in_transit", "delayed", "delivered"]).default("planned"),
  pickup: z.string().min(1).max(120),
  dropoff: z.string().min(1).max(120),
  etaHours: z.coerce.number().min(0).max(24 * 30).default(0),
  revenueUsd: z.coerce.number().min(0).max(100000000).default(0),
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const client = await clientPromise;
  const db = client.db();

  const loads = await db
    .collection("loads")
    .find({}, { sort: { createdAt: -1 }, limit: 200 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      loads: loads.map((l: any) => ({
        id: String(l._id),
        status: String(l.status ?? "planned"),
        pickup: String(l.pickup ?? ""),
        dropoff: String(l.dropoff ?? ""),
        etaHours: Number(l.etaHours ?? 0),
        revenueUsd: Number(l.revenueUsd ?? 0),
        truckId: l.truckId ? String(l.truckId) : "",
        createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : "",
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
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateLoadSchema.safeParse(body);
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

  const client = await clientPromise;
  const db = client.db();

  let truckObjectId: ObjectId | null = null;
  if (parsed.data.truckId) {
    try {
      truckObjectId = new ObjectId(parsed.data.truckId);
    } catch {
      return NextResponse.json({ error: "Invalid truckId." }, { status: 400 });
    }
  }

  const doc = {
    status: parsed.data.status,
    pickup: parsed.data.pickup,
    dropoff: parsed.data.dropoff,
    etaHours: parsed.data.etaHours,
    revenueUsd: parsed.data.revenueUsd,
    truckId: parsed.data.truckId ? String(parsed.data.truckId) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("loads").insertOne(doc);

  if (truckObjectId) {
    const truck = await db.collection("trucks").findOne(
      { _id: truckObjectId },
      { projection: { currentLoadId: 1 } }
    );
    const prevLoadId = truck?.currentLoadId ? String((truck as any).currentLoadId) : "";

    if (prevLoadId && prevLoadId !== String(result.insertedId)) {
      await db.collection("loads").updateOne(
        { _id: new ObjectId(prevLoadId) },
        { $set: { truckId: null, updatedAt: new Date() } }
      );
    }

    await db.collection("trucks").updateOne(
      { _id: truckObjectId },
      {
        $set: {
          currentLoadId: String(result.insertedId),
          updatedAt: new Date(),
        },
      }
    );
  }

  return NextResponse.json(
    { ok: true, loadId: String(result.insertedId) },
    { status: 200 }
  );
}
