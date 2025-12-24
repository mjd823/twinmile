import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const UpdateTruckSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    status: z.enum(["active", "idle", "maintenance"]).optional(),
    fuelPct: z.coerce.number().min(0).max(100).optional(),
    lat: z.coerce.number().min(-90).max(90).nullable().optional(),
    lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: "Invalid truck id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateTruckSchema.safeParse(body);
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

  const update: Record<string, any> = {};
  if (typeof parsed.data.name === "string") update.name = parsed.data.name;
  if (typeof parsed.data.status === "string") update.status = parsed.data.status;
  if (typeof parsed.data.fuelPct === "number") update.fuelPct = parsed.data.fuelPct;
  if (parsed.data.lat !== undefined) update.lat = parsed.data.lat ?? null;
  if (parsed.data.lng !== undefined) update.lng = parsed.data.lng ?? null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const truckObjectId = new ObjectId(id);

  const result = await db.collection("trucks").updateOne(
    { _id: truckObjectId },
    { $set: { ...update, updatedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Truck not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: "Invalid truck id." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const truckObjectId = new ObjectId(id);

  const truck = await db.collection("trucks").findOne({ _id: truckObjectId });
  if (!truck) {
    return NextResponse.json({ error: "Truck not found." }, { status: 404 });
  }

  await Promise.all([
    db.collection("loads").updateMany({ truckId: id }, { $set: { truckId: null, updatedAt: new Date() } }),
    db.collection("trucks").deleteOne({ _id: truckObjectId }),
  ]);

  return NextResponse.json({ ok: true }, { status: 200 });
}
