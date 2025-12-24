import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const AssignDriverSchema = z.object({
  driverUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
});

export async function POST(
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
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: "Invalid truck id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = AssignDriverSchema.safeParse(body);
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

  const truckObjectId = new ObjectId(id);

  let driverUserId: string | null = null;
  let driverName: string | null = null;

  if (parsed.data.driverUserId) {
    driverUserId = parsed.data.driverUserId;
    const driver = await db
      .collection("users")
      .findOne(
        { _id: new ObjectId(driverUserId), role: "driver" },
        { projection: { email: 1, firstName: 1, lastName: 1 } }
      );

    if (!driver) {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }

    const fn = String((driver as any).firstName ?? "").trim();
    const ln = String((driver as any).lastName ?? "").trim();
    driverName = `${fn} ${ln}`.trim() || String((driver as any).email ?? "");

    await db.collection("trucks").updateMany(
      { _id: { $ne: truckObjectId }, driverUserId },
      {
        $set: {
          driverUserId: null,
          driverName: null,
          updatedAt: new Date(),
        },
      }
    );
  }

  await db.collection("trucks").updateOne(
    { _id: truckObjectId },
    {
      $set: {
        driverUserId,
        driverName,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
