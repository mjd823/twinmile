import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const PatchSchema = z
  .object({
    truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    gallons: z.coerce.number().min(0).max(10000).optional(),
    costUsd: z.coerce.number().min(0).max(100000000).optional(),
    odometer: z.union([z.coerce.number().min(0).max(100000000), z.literal(""), z.null()]).optional(),
    notes: z.union([z.string().max(2000), z.literal(""), z.null()]).optional(),
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
  let fuelObjectId: ObjectId;
  try {
    fuelObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
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

  const $set: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.truckId !== undefined) $set.truckId = String(parsed.data.truckId);
  if (parsed.data.at !== undefined) {
    const v = parsed.data.at;
    $set.at = v === "" || v == null ? null : new Date(String(v));
  }
  if (parsed.data.gallons !== undefined) $set.gallons = Number(parsed.data.gallons);
  if (parsed.data.costUsd !== undefined) $set.costUsd = Number(parsed.data.costUsd);
  if (parsed.data.odometer !== undefined) {
    const v = parsed.data.odometer;
    $set.odometer = v === "" || v == null ? null : Number(v);
  }
  if (parsed.data.notes !== undefined) {
    const v = parsed.data.notes;
    $set.notes = v === "" || v == null ? null : String(v);
  }

  if (Object.keys($set).length === 1) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  if ($set.at instanceof Date && Number.isNaN($set.at.getTime())) {
    return NextResponse.json({ error: "Invalid at timestamp." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("fuelLogs").findOne({ _id: fuelObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.collection("fuelLogs").updateOne({ _id: fuelObjectId }, { $set });

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
  let fuelObjectId: ObjectId;
  try {
    fuelObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("fuelLogs").findOne({ _id: fuelObjectId });
  if (!existing) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await db.collection("fuelLogs").deleteOne({ _id: fuelObjectId });

  return NextResponse.json({ ok: true }, { status: 200 });
}
