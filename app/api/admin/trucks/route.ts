import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateTruckSchema = z.object({
  name: z.string().min(1).max(80),
  status: z.enum(["active", "idle", "maintenance"]).default("idle"),
  fuelPct: z.coerce.number().min(0).max(100).default(0),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  driverUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
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

  const trucks = await db
    .collection("trucks")
    .find({}, { sort: { updatedAt: -1, createdAt: -1 }, limit: 200 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      trucks: trucks.map((t: any) => ({
        id: String(t._id),
        name: String(t.name ?? ""),
        status: String(t.status ?? "idle"),
        fuelPct: Number(t.fuelPct ?? 0),
        lat: typeof t.lat === "number" ? t.lat : undefined,
        lng: typeof t.lng === "number" ? t.lng : undefined,
        driverName: t.driverName ? String(t.driverName) : "",
        driverUserId: t.driverUserId ? String(t.driverUserId) : "",
        currentLoadId: t.currentLoadId ? String(t.currentLoadId) : "",
        updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : "",
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
  const parsed = CreateTruckSchema.safeParse(body);
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
      { driverUserId },
      {
        $set: {
          driverUserId: null,
          driverName: null,
          updatedAt: new Date(),
        },
      }
    );
  }

  const doc = {
    name: parsed.data.name,
    status: parsed.data.status,
    fuelPct: parsed.data.fuelPct,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    driverName,
    driverUserId,
    currentLoadId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("trucks").insertOne(doc);

  return NextResponse.json(
    { ok: true, truckId: String(result.insertedId) },
    { status: 200 }
  );
}
