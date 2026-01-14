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
