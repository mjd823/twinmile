import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const PatchSchema = z
  .object({
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    name: z.string().min(1).max(140).optional(),
    rateUsd: z.coerce.number().min(0).max(100000000).optional(),
    rateType: z.enum(["flat", "per_mile", "hourly"]).optional(),
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
  let contractObjectId: ObjectId;
  try {
    contractObjectId = new ObjectId(String(id));
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
  if (parsed.data.customerId !== undefined) $set.customerId = String(parsed.data.customerId);
  if (parsed.data.name !== undefined) $set.name = String(parsed.data.name);
  if (parsed.data.rateType !== undefined) $set.rateType = String(parsed.data.rateType);
  if (parsed.data.rateUsd !== undefined) $set.rateUsd = Number(parsed.data.rateUsd);
  if (parsed.data.notes !== undefined) {
    const v = parsed.data.notes;
    $set.notes = v === "" || v == null ? null : String(v);
  }

  if (Object.keys($set).length === 1) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("contracts").findOne({ _id: contractObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.collection("contracts").updateOne({ _id: contractObjectId }, { $set });

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
  let contractObjectId: ObjectId;
  try {
    contractObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("contracts").findOne({ _id: contractObjectId });
  if (!existing) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await db.collection("contracts").deleteOne({ _id: contractObjectId });

  return NextResponse.json({ ok: true }, { status: 200 });
}
