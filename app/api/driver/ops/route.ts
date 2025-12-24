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

export async function GET() {
  const driver = await requireRole("driver");
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const client = await clientPromise;
  const db = client.db();

  const driverUserId = String((driver as any)._id);

  const truck = await db
    .collection("trucks")
    .findOne(
      {
        $or: [{ driverUserId }, { driverName: String(driver.email) }],
      },
      { sort: { updatedAt: -1 } }
    );

  const truckId = truck?._id ? String(truck._id) : null;
  const currentLoadId = truck?.currentLoadId ? String(truck.currentLoadId) : null;

  let currentLoadObjectId: ObjectId | null = null;
  if (currentLoadId && /^[0-9a-fA-F]{24}$/.test(currentLoadId)) {
    try {
      currentLoadObjectId = new ObjectId(currentLoadId);
    } catch {
      currentLoadObjectId = null;
    }
  }

  const [currentLoad, fuelLogs, maintenanceLogs, routeEvents] = await Promise.all([
    currentLoadObjectId
      ? db.collection("loads").findOne({ _id: currentLoadObjectId }).catch(() => null)
      : Promise.resolve(null),
    truckId
      ? db
          .collection("fuelLogs")
          .find({ truckId }, { sort: { at: -1 }, limit: 20 })
          .toArray()
          .catch(() => [] as any[])
      : Promise.resolve([] as any[]),
    truckId
      ? db
          .collection("maintenanceLogs")
          .find({ truckId }, { sort: { at: -1 }, limit: 20 })
          .toArray()
          .catch(() => [] as any[])
      : Promise.resolve([] as any[]),
    db
      .collection("routeEvents")
      .find(
        truckId
          ? { $or: [{ truckId }, ...(currentLoadId ? [{ loadId: currentLoadId }] : [])] }
          : currentLoadId
            ? { loadId: currentLoadId }
            : {},
        { sort: { at: -1 }, limit: 25 }
      )
      .toArray()
      .catch(() => [] as any[]),
  ]);

  return NextResponse.json(
    {
      ok: true,
      driver: {
        email: String(driver.email),
        firstName: (driver as any).firstName ? String((driver as any).firstName) : "",
        lastName: (driver as any).lastName ? String((driver as any).lastName) : "",
        isOwnerOperator: Boolean((driver as any).isOwnerOperator),
      },
      truck: truck ? toPlain(truck) : null,
      currentLoad: currentLoad ? toPlain(currentLoad) : null,
      fuelLogs: toPlain(fuelLogs),
      maintenanceLogs: toPlain(maintenanceLogs),
      routeEvents: toPlain(routeEvents),
    },
    {
      status: 200,
      headers: { "cache-control": "no-store, max-age=0" },
    }
  );
}
