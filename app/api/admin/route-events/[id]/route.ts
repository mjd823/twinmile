import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const PatchSchema = z
  .object({
    at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    truckId: z.union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal(""), z.null()]).optional(),
    loadId: z.union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal(""), z.null()]).optional(),
    name: z.enum(["status", "note", "delay", "fuel", "maintenance", "dispatch"]).optional(),
    message: z.string().min(1).max(2000).optional(),
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
  let eventObjectId: ObjectId;
  try {
    eventObjectId = new ObjectId(String(id));
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
  if (parsed.data.name !== undefined) $set.name = String(parsed.data.name);
  if (parsed.data.message !== undefined) $set.message = String(parsed.data.message);
  if (parsed.data.at !== undefined) {
    const v = parsed.data.at;
    $set.at = v === "" || v == null ? null : new Date(String(v));
  }
  if (parsed.data.truckId !== undefined) {
    const v = parsed.data.truckId;
    $set.truckId = v === "" || v == null ? null : String(v);
  }
  if (parsed.data.loadId !== undefined) {
    const v = parsed.data.loadId;
    $set.loadId = v === "" || v == null ? null : String(v);
  }

  if (Object.keys($set).length === 1) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  if ($set.at instanceof Date && Number.isNaN($set.at.getTime())) {
    return NextResponse.json({ error: "Invalid at timestamp." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("routeEvents").findOne({ _id: eventObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.collection("routeEvents").updateOne({ _id: eventObjectId }, { $set });

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
  let eventObjectId: ObjectId;
  try {
    eventObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("routeEvents").findOne({ _id: eventObjectId });
  if (!existing) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await db.collection("routeEvents").deleteOne({ _id: eventObjectId });

  return NextResponse.json({ ok: true }, { status: 200 });
}
