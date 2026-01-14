import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const PatchSchema = z
  .object({
    name: z.string().min(1).max(140).optional(),
    contactEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
    contactPhone: z.union([z.string().max(40), z.literal(""), z.null()]).optional(),
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
  let customerObjectId: ObjectId;
  try {
    customerObjectId = new ObjectId(String(id));
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
  if (parsed.data.name !== undefined) $set.name = parsed.data.name;
  if (parsed.data.contactEmail !== undefined) {
    const v = parsed.data.contactEmail;
    $set.contactEmail = v === "" || v == null ? null : String(v);
  }
  if (parsed.data.contactPhone !== undefined) {
    const v = parsed.data.contactPhone;
    $set.contactPhone = v === "" || v == null ? null : String(v);
  }
  if (parsed.data.notes !== undefined) {
    const v = parsed.data.notes;
    $set.notes = v === "" || v == null ? null : String(v);
  }

  if (Object.keys($set).length === 1) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("customers").findOne({ _id: customerObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.collection("customers").updateOne({ _id: customerObjectId }, { $set });

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
  let customerObjectId: ObjectId;
  try {
    customerObjectId = new ObjectId(String(id));
  } catch {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("customers").findOne({ _id: customerObjectId });
  if (!existing) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await Promise.all([
    db.collection("contracts").deleteMany({ customerId: String(customerObjectId) }).catch(() => null),
    db.collection("customers").deleteOne({ _id: customerObjectId }),
  ]);

  return NextResponse.json({ ok: true }, { status: 200 });
}
