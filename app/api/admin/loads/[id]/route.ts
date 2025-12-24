import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const UpdateLoadSchema = z.object({
  status: z.enum(["planned", "in_transit", "delayed", "delivered"]).optional(),
  pickup: z.string().min(1).max(120).optional(),
  dropoff: z.string().min(1).max(120).optional(),
  etaHours: z.coerce.number().min(0).max(24 * 30).optional(),
  revenueUsd: z.coerce.number().min(0).max(100000000).optional(),
  truckId: z
    .union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal(""), z.null()])
    .optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
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

  const { id } = await ctx.params;
  let loadObjectId: ObjectId;
  try {
    loadObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateLoadSchema.safeParse(body);
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

  const existing = await db.collection("loads").findOne({ _id: loadObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let nextTruckId: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "truckId")) {
    const raw = parsed.data.truckId;
    if (raw === "" || raw == null) nextTruckId = null;
    else nextTruckId = String(raw);
  }

  const $set: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.status != null) $set.status = parsed.data.status;
  if (parsed.data.pickup != null) $set.pickup = parsed.data.pickup;
  if (parsed.data.dropoff != null) $set.dropoff = parsed.data.dropoff;
  if (parsed.data.etaHours != null) $set.etaHours = parsed.data.etaHours;
  if (parsed.data.revenueUsd != null) $set.revenueUsd = parsed.data.revenueUsd;
  if (nextTruckId !== undefined) $set.truckId = nextTruckId;

  await db.collection("loads").updateOne({ _id: loadObjectId }, { $set });

  const prevTruckId = existing?.truckId ? String(existing.truckId) : "";
  const nextTruckIdStr = nextTruckId === undefined ? prevTruckId : nextTruckId ? String(nextTruckId) : "";

  if (prevTruckId && prevTruckId !== nextTruckIdStr) {
    try {
      await db.collection("trucks").updateOne(
        { _id: new ObjectId(prevTruckId), currentLoadId: String(loadObjectId) },
        { $set: { currentLoadId: null, updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  }

  if (nextTruckIdStr && nextTruckIdStr !== prevTruckId) {
    try {
      const nextTruck = await db.collection("trucks").findOne(
        { _id: new ObjectId(nextTruckIdStr) },
        { projection: { currentLoadId: 1 } }
      );
      const prevLoadId = nextTruck?.currentLoadId ? String((nextTruck as any).currentLoadId) : "";

      if (prevLoadId && prevLoadId !== String(loadObjectId)) {
        await db.collection("loads").updateOne(
          { _id: new ObjectId(prevLoadId) },
          { $set: { truckId: null, updatedAt: new Date() } }
        );
      }

      await db.collection("trucks").updateOne(
        { _id: new ObjectId(nextTruckIdStr) },
        { $set: { currentLoadId: String(loadObjectId), updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
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

  const { id } = await ctx.params;
  let loadObjectId: ObjectId;
  try {
    loadObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("loads").findOne({ _id: loadObjectId });
  if (!existing) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const truckId = existing?.truckId ? String(existing.truckId) : "";

  await db.collection("loads").deleteOne({ _id: loadObjectId });

  if (truckId) {
    try {
      await db.collection("trucks").updateOne(
        { _id: new ObjectId(truckId), currentLoadId: String(loadObjectId) },
        { $set: { currentLoadId: null, updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
