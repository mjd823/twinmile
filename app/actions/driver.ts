"use server";

import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { updateDriverProfile } from "@/lib/auth/users";
import { writeAuditEvent } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";

import { getClientIpFromHeaders, getUserAgentFromHeaders, isSameOriginFromHeaders } from "@/app/actions/_request";

function toPlain(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if (typeof (value as any).toHexString === "function") {
      try {
        return (value as any).toHexString();
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

const PatchSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  isOwnerOperator: z.boolean().optional(),
});

export async function getDriverProfileAction(): Promise<
  | { ok: true; profile: { email: string; firstName: string; lastName: string; isOwnerOperator: boolean } }
  | { ok: false; error: string }
> {
  const driver = await requireRole("driver");
  if (!driver) return { ok: false, error: "Unauthorized." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const userId = String((driver as any)._id);
  if (!/^[0-9a-fA-F]{24}$/.test(userId)) return { ok: false, error: "Invalid session." };

  const client = await clientPromise;
  const db = client.db();

  const user = await db
    .collection("users")
    .findOne(
      { _id: new ObjectId(userId), role: "driver" },
      { projection: { email: 1, firstName: 1, lastName: 1, isOwnerOperator: 1 } }
    );

  if (!user) return { ok: false, error: "Unauthorized." };

  return {
    ok: true,
    profile: {
      email: String((user as any).email ?? ""),
      firstName: (user as any).firstName ? String((user as any).firstName) : "",
      lastName: (user as any).lastName ? String((user as any).lastName) : "",
      isOwnerOperator: Boolean((user as any).isOwnerOperator),
    },
  };
}

export async function updateDriverProfileAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const driver = await requireRole("driver");
  if (!driver) return { ok: false, error: "Unauthorized." };

  const rl = await rateLimit({
    key: `driver:profile_update:user:${String((driver as any)._id)}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };

  const userId = String((driver as any)._id);
  if (!/^[0-9a-fA-F]{24}$/.test(userId)) return { ok: false, error: "Invalid session." };

  const parsed = PatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    await updateDriverProfile(new ObjectId(userId), parsed.data);

    await writeAuditEvent({
      name: "driver.profile.update",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((driver as any)._id),
      actorRole: "driver",
      subjectUserId: String((driver as any)._id),
      meta: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        isOwnerOperator: parsed.data.isOwnerOperator,
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unable to update profile." };
  }
}

// ── Load Status Updates ─────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  planned: ["accepted"],
  accepted: ["picked_up"],
  picked_up: ["in_transit"],
  in_transit: ["delivered"],
};

const UpdateLoadStatusSchema = z.object({
  loadId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  newStatus: z.enum(["accepted", "picked_up", "in_transit", "delivered"]),
  note: z.string().max(500).optional(),
});

export async function updateLoadStatusAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const driver = await requireRole("driver");
  if (!driver) return { ok: false, error: "Unauthorized." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const rl = await rateLimit({
    key: `driver:load_status:user:${String((driver as any)._id)}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };

  const parsed = UpdateLoadStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const client = await clientPromise;
  const db = client.db();

  const driverUserId = String((driver as any)._id);

  // Verify the load belongs to a truck assigned to this driver
  const truck = await db.collection("trucks").findOne({
    $or: [{ driverUserId }, { driverName: String((driver as any).email) }],
  });
  if (!truck) return { ok: false, error: "No truck assigned to you." };

  const loadObjectId = new ObjectId(parsed.data.loadId);
  const load = await db.collection("loads").findOne({ _id: loadObjectId });
  if (!load) return { ok: false, error: "Load not found." };

  // Verify this load is on the driver's truck
  const loadTruckId = load.truckId ? String(load.truckId) : null;
  const truckId = String(truck._id);
  if (loadTruckId !== truckId) {
    return { ok: false, error: "This load is not assigned to your truck." };
  }

  // Validate transition
  const currentStatus = String(load.status ?? "planned");
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(parsed.data.newStatus)) {
    return {
      ok: false,
      error: `Cannot change status from "${currentStatus}" to "${parsed.data.newStatus}".`,
    };
  }

  const now = new Date();

  // Update the load
  const updateFields: Record<string, any> = {
    status: parsed.data.newStatus,
    updatedAt: now,
  };
  if (parsed.data.newStatus === "delivered") {
    updateFields.deliveredAt = now;
  }
  if (parsed.data.newStatus === "picked_up") {
    updateFields.pickedUpAt = now;
  }

  await db.collection("loads").updateOne(
    { _id: loadObjectId },
    { $set: updateFields }
  );

  // Create a route event
  const eventMessages: Record<string, string> = {
    accepted: "Load accepted by driver",
    picked_up: "Freight picked up",
    in_transit: "In transit to delivery",
    delivered: "Delivered successfully",
  };

  await db.collection("routeEvents").insertOne({
    truckId,
    loadId: parsed.data.loadId,
    driverUserId,
    name: `load.${parsed.data.newStatus}`,
    message: parsed.data.note
      ? `${eventMessages[parsed.data.newStatus]}. Note: ${parsed.data.note}`
      : eventMessages[parsed.data.newStatus],
    at: now,
  });

  // If delivered, auto-create settlement record (80% gross)
  if (parsed.data.newStatus === "delivered") {
    const revenueUsd = Number(load.revenueUsd ?? 0);
    if (revenueUsd > 0) {
      const driverPct = 0.80;
      const driverPayout = Math.round(revenueUsd * driverPct * 100) / 100;
      const companyShare = Math.round(revenueUsd * (1 - driverPct) * 100) / 100;

      // Determine settlement week (Monday-based)
      const weekStart = new Date(now);
      weekStart.setUTCHours(0, 0, 0, 0);
      const day = weekStart.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
      weekStart.setUTCDate(weekStart.getUTCDate() - diff);

      await db.collection("settlements").insertOne({
        driverUserId,
        loadId: parsed.data.loadId,
        truckId,
        revenueUsd,
        driverPct,
        driverPayout,
        companyShare,
        weekStart,
        status: "pending",
        createdAt: now,
      });
    }

    // Clear truck's current load
    await db.collection("trucks").updateOne(
      { _id: truck._id },
      { $set: { currentLoadId: null, updatedAt: now } }
    );
  }

  await writeAuditEvent({
    name: `driver.load.${parsed.data.newStatus}`,
    at: now,
    ip,
    userAgent,
    actorUserId: driverUserId,
    actorRole: "driver",
    meta: {
      loadId: parsed.data.loadId,
      truckId,
      previousStatus: currentStatus,
      newStatus: parsed.data.newStatus,
      note: parsed.data.note || undefined,
    },
  });

  return { ok: true };
}

// ── Load History ────────────────────────────────────────────────────

export async function getDriverLoadHistoryAction(): Promise<
  | { ok: true; loads: any[] }
  | { ok: false; error: string }
> {
  const driver = await requireRole("driver");
  if (!driver) return { ok: false, error: "Unauthorized." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const client = await clientPromise;
  const db = client.db();

  const driverUserId = String((driver as any)._id);

  const truck = await db.collection("trucks").findOne({
    $or: [{ driverUserId }, { driverName: String((driver as any).email) }],
  });
  if (!truck) return { ok: true, loads: [] };

  const truckId = String(truck._id);

  const loads = await db
    .collection("loads")
    .find(
      { truckId, status: "delivered" },
      { sort: { deliveredAt: -1 }, limit: 50 }
    )
    .toArray();

  return { ok: true, loads: toPlain(loads) };
}

// ── Driver Settlements ──────────────────────────────────────────────

export async function getDriverSettlementsAction(): Promise<
  | {
      ok: true;
      settlements: any[];
      currentWeekTotal: number;
      ytdTotal: number;
    }
  | { ok: false; error: string }
> {
  const driver = await requireRole("driver");
  if (!driver) return { ok: false, error: "Unauthorized." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const client = await clientPromise;
  const db = client.db();

  const driverUserId = String((driver as any)._id);

  // Current week start (Monday)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setUTCDate(weekStart.getUTCDate() - diff);

  // YTD start
  const ytdStart = new Date(now.getUTCFullYear(), 0, 1);

  const [settlements, currentWeekAgg, ytdAgg] = await Promise.all([
    db
      .collection("settlements")
      .find({ driverUserId }, { sort: { createdAt: -1 }, limit: 100 })
      .toArray(),
    db
      .collection("settlements")
      .aggregate([
        { $match: { driverUserId, weekStart: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: "$driverPayout" } } },
      ])
      .toArray(),
    db
      .collection("settlements")
      .aggregate([
        { $match: { driverUserId, createdAt: { $gte: ytdStart } } },
        { $group: { _id: null, total: { $sum: "$driverPayout" } } },
      ])
      .toArray(),
  ]);

  return {
    ok: true,
    settlements: toPlain(settlements),
    currentWeekTotal: currentWeekAgg[0]?.total ?? 0,
    ytdTotal: ytdAgg[0]?.total ?? 0,
  };
}

export async function getDriverOpsAction(): Promise<
  | {
      ok: true;
      driver: { email: string; firstName: string; lastName: string; isOwnerOperator: boolean };
      truck: any | null;
      currentLoad: any | null;
      fuelLogs: any[];
      maintenanceLogs: any[];
      routeEvents: any[];
    }
  | { ok: false; error: string }
> {
  const driver = await requireRole("driver");
  if (!driver) return { ok: false, error: "Unauthorized." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const client = await clientPromise;
  const db = client.db();

  const driverUserId = String((driver as any)._id);

  const truck = await db
    .collection("trucks")
    .findOne(
      { $or: [{ driverUserId }, { driverName: String((driver as any).email) }] },
      { sort: { updatedAt: -1 } }
    );

  const truckId = truck?._id ? String(truck._id) : null;
  const currentLoadId = truck?.currentLoadId ? String((truck as any).currentLoadId) : null;

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

  return {
    ok: true,
    driver: {
      email: String((driver as any).email),
      firstName: (driver as any).firstName ? String((driver as any).firstName) : "",
      lastName: (driver as any).lastName ? String((driver as any).lastName) : "",
      isOwnerOperator: Boolean((driver as any).isOwnerOperator),
    },
    truck: truck ? toPlain(truck) : null,
    currentLoad: currentLoad ? toPlain(currentLoad) : null,
    fuelLogs: toPlain(fuelLogs),
    maintenanceLogs: toPlain(maintenanceLogs),
    routeEvents: toPlain(routeEvents),
  };
}
