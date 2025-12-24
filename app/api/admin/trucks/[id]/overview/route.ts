import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";

function toPlain(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") {
      try {
        return value.toHexString();
      } catch {
        return String(value);
      }
    }

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }

  return value;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const driverUserId = truck.driverUserId ? String(truck.driverUserId) : null;
  const currentLoadId = truck.currentLoadId ? String(truck.currentLoadId) : null;

  let currentLoadObjectId: ObjectId | null = null;
  if (currentLoadId && /^[0-9a-fA-F]{24}$/.test(currentLoadId)) {
    try {
      currentLoadObjectId = new ObjectId(currentLoadId);
    } catch {
      currentLoadObjectId = null;
    }
  }

  const [driver, currentLoad, fuelLogs, maintenanceLogs, routeEvents] = await Promise.all([
    driverUserId
      ? db
          .collection("users")
          .findOne(
            { _id: new ObjectId(driverUserId), role: "driver" },
            { projection: { email: 1, firstName: 1, lastName: 1 } }
          )
          .catch(() => null)
      : Promise.resolve(null),
    currentLoadObjectId
      ? db.collection("loads").findOne({ _id: currentLoadObjectId }).catch(() => null)
      : Promise.resolve(null),
    db
      .collection("fuelLogs")
      .find({ truckId: id }, { sort: { at: -1 }, limit: 25 })
      .toArray()
      .catch(() => [] as any[]),
    db
      .collection("maintenanceLogs")
      .find({ truckId: id }, { sort: { at: -1 }, limit: 25 })
      .toArray()
      .catch(() => [] as any[]),
    db
      .collection("routeEvents")
      .find(
        { $or: [{ truckId: id }, ...(currentLoadId ? [{ loadId: currentLoadId }] : [])] },
        { sort: { at: -1 }, limit: 50 }
      )
      .toArray()
      .catch(() => [] as any[]),
  ]);

  return NextResponse.json(
    {
      ok: true,
      truck: toPlain(truck),
      driver: driver ? toPlain(driver) : null,
      currentLoad: currentLoad ? toPlain(currentLoad) : null,
      fuelLogs: toPlain(fuelLogs),
      maintenanceLogs: toPlain(maintenanceLogs),
      routeEvents: toPlain(routeEvents),
    },
    { status: 200, headers: { "cache-control": "no-store, max-age=0" } }
  );
}
