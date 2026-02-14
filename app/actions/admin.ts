"use server";

import crypto from "crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import {
  createUser,
  findUserById,
  setMustChangePassword,
  setUserPassword,
  updateDriverProfile,
} from "@/lib/auth/users";
import { randomToken } from "@/lib/auth/crypto";
import { writeAuditEvent } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";

import { getClientIpFromHeaders, getUserAgentFromHeaders, isSameOriginFromHeaders } from "@/app/actions/_request";

function fullName(u: { firstName?: string; lastName?: string; email?: string }) {
  const name = `${String(u.firstName ?? "").trim()} ${String(u.lastName ?? "").trim()}`.trim();
  return name || String(u.email ?? "").trim();
}

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

async function requireAdminOrError(): Promise<
  | { ok: true; admin: any }
  | { ok: false; error: string }
> {
  const admin = await requireRole("admin");
  if (!admin) return { ok: false, error: "Unauthorized." };
  return { ok: true, admin };
}

function generateTempPassword() {
  const raw = crypto.randomBytes(12).toString("base64url");
  return `TM-${raw}`;
}

// =====================
// Ops dashboard
// =====================

export async function getAdminOpsAction(): Promise<
  | { ok: true; trucks: any[]; loads: any[] }
  | { ok: false; error: string }
> {
  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const client = await clientPromise;
  const db = client.db();

  const [trucks, loads] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { sort: { updatedAt: -1 }, limit: 100 })
      .toArray()
      .catch(() => [] as any[]),
    db
      .collection("loads")
      .find({}, { sort: { createdAt: -1 }, limit: 100 })
      .toArray()
      .catch(() => [] as any[]),
  ]);

  const driverUserIds = Array.from(
    new Set(
      (trucks ?? [])
        .map((t: any) => (t?.driverUserId ? String(t.driverUserId) : ""))
        .filter(Boolean)
    )
  );

  const driverObjectIds = driverUserIds
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ObjectId[];

  const driverUsers = driverObjectIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: driverObjectIds } }, { projection: { email: 1, firstName: 1, lastName: 1 } })
        .toArray()
        .catch(() => [] as any[])
    : ([] as any[]);

  const driverById = new Map<string, any>();
  for (const u of driverUsers) {
    const id = u?._id ? String(u._id) : "";
    if (id) driverById.set(id, u);
  }

  for (const t of trucks as any[]) {
    const did = t?.driverUserId ? String(t.driverUserId) : "";
    if (!did) continue;
    const u = driverById.get(did);
    if (!u) continue;
    const name = fullName(u);
    if (name) t.driverName = name;
  }

  return { ok: true, trucks: toPlain(trucks), loads: toPlain(loads) };
}

// =====================
// Trucks
// =====================

const CreateTruckSchema = z.object({
  name: z.string().min(1).max(80),
  status: z.enum(["active", "idle", "maintenance"]).default("idle"),
  fuelPct: z.coerce.number().min(0).max(100).default(0),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  driverUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export async function createTruckAction(
  input: unknown
): Promise<{ ok: true; truckId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateTruckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

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

    if (!driver) return { ok: false, error: "Driver not found." };

    const fn = String((driver as any).firstName ?? "").trim();
    const ln = String((driver as any).lastName ?? "").trim();
    driverName = `${fn} ${ln}`.trim() || String((driver as any).email ?? "");

    await db.collection("trucks").updateMany(
      { driverUserId },
      { $set: { driverUserId: null, driverName: null, updatedAt: new Date() } }
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
  return { ok: true, truckId: String(result.insertedId) };
}

const UpdateTruckSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    status: z.enum(["active", "idle", "maintenance"]).optional(),
    fuelPct: z.coerce.number().min(0).max(100).optional(),
    lat: z.coerce.number().min(-90).max(90).nullable().optional(),
    lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  })
  .strict();

export async function updateTruckAction(
  truckId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(truckId)) return { ok: false, error: "Invalid truck id." };

  const parsed = UpdateTruckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const update: Record<string, any> = {};
  if (typeof parsed.data.name === "string") update.name = parsed.data.name;
  if (typeof parsed.data.status === "string") update.status = parsed.data.status;
  if (typeof parsed.data.fuelPct === "number") update.fuelPct = parsed.data.fuelPct;
  if (parsed.data.lat !== undefined) update.lat = parsed.data.lat ?? null;
  if (parsed.data.lng !== undefined) update.lng = parsed.data.lng ?? null;

  if (Object.keys(update).length === 0) return { ok: false, error: "No fields to update." };

  const client = await clientPromise;
  const db = client.db();

  const truckObjectId = new ObjectId(truckId);
  const result = await db
    .collection("trucks")
    .updateOne({ _id: truckObjectId }, { $set: { ...update, updatedAt: new Date() } });

  if (result.matchedCount === 0) return { ok: false, error: "Truck not found." };
  return { ok: true };
}

export async function deleteTruckAction(truckId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(truckId)) return { ok: false, error: "Invalid truck id." };

  const client = await clientPromise;
  const db = client.db();
  const truckObjectId = new ObjectId(truckId);

  const truck = await db.collection("trucks").findOne({ _id: truckObjectId });
  if (!truck) return { ok: false, error: "Truck not found." };

  await Promise.all([
    db.collection("loads").updateMany({ truckId }, { $set: { truckId: null, updatedAt: new Date() } }),
    db.collection("trucks").deleteOne({ _id: truckObjectId }),
  ]);

  return { ok: true };
}

const AssignDriverSchema = z.object({
  driverUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
});

export async function assignDriverToTruckAction(
  truckId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(truckId)) return { ok: false, error: "Invalid truck id." };

  const parsed = AssignDriverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const truckObjectId = new ObjectId(truckId);

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

    if (!driver) return { ok: false, error: "Driver not found." };

    const fn = String((driver as any).firstName ?? "").trim();
    const ln = String((driver as any).lastName ?? "").trim();
    driverName = `${fn} ${ln}`.trim() || String((driver as any).email ?? "");

    await db.collection("trucks").updateMany(
      { _id: { $ne: truckObjectId }, driverUserId },
      { $set: { driverUserId: null, driverName: null, updatedAt: new Date() } }
    );
  }

  await db.collection("trucks").updateOne(
    { _id: truckObjectId },
    { $set: { driverUserId, driverName, updatedAt: new Date() } }
  );

  return { ok: true };
}

export async function getTruckOverviewAction(
  truckId: string
): Promise<
  | { ok: true; truck: any; driver: any | null; currentLoad: any | null; fuelLogs: any[]; maintenanceLogs: any[]; routeEvents: any[] }
  | { ok: false; error: string }
> {
  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(truckId)) return { ok: false, error: "Invalid truck id." };

  const client = await clientPromise;
  const db = client.db();

  const truckObjectId = new ObjectId(truckId);
  const truck = await db.collection("trucks").findOne({ _id: truckObjectId });
  if (!truck) return { ok: false, error: "Truck not found." };

  const driverUserId = (truck as any).driverUserId ? String((truck as any).driverUserId) : null;
  const currentLoadId = (truck as any).currentLoadId ? String((truck as any).currentLoadId) : null;

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
      .find({ truckId }, { sort: { at: -1 }, limit: 25 })
      .toArray()
      .catch(() => [] as any[]),
    db
      .collection("maintenanceLogs")
      .find({ truckId }, { sort: { at: -1 }, limit: 25 })
      .toArray()
      .catch(() => [] as any[]),
    db
      .collection("routeEvents")
      .find(
        { $or: [{ truckId }, ...(currentLoadId ? [{ loadId: currentLoadId }] : [])] },
        { sort: { at: -1 }, limit: 50 }
      )
      .toArray()
      .catch(() => [] as any[]),
  ]);

  return {
    ok: true,
    truck: toPlain(truck),
    driver: driver ? toPlain(driver) : null,
    currentLoad: currentLoad ? toPlain(currentLoad) : null,
    fuelLogs: toPlain(fuelLogs),
    maintenanceLogs: toPlain(maintenanceLogs),
    routeEvents: toPlain(routeEvents),
  };
}

// =====================
// Loads
// =====================

const CreateLoadSchema = z.object({
  status: z.enum(["planned", "in_transit", "delayed", "delivered"]).default("planned"),
  pickup: z.string().min(1).max(120),
  dropoff: z.string().min(1).max(120),
  etaHours: z.coerce.number().min(0).max(24 * 30).default(0),
  revenueUsd: z.coerce.number().min(0).max(100000000).default(0),
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export async function listLoadsAction(): Promise<{ ok: true; loads: any[] } | { ok: false; error: string }> {
  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const client = await clientPromise;
  const db = client.db();

  const loads = await db.collection("loads").find({}, { sort: { createdAt: -1 }, limit: 200 }).toArray();

  return {
    ok: true,
    loads: loads.map((l: any) => ({
      id: String(l._id),
      status: String(l.status ?? "planned"),
      pickup: String(l.pickup ?? ""),
      dropoff: String(l.dropoff ?? ""),
      etaHours: Number(l.etaHours ?? 0),
      revenueUsd: Number(l.revenueUsd ?? 0),
      truckId: l.truckId ? String(l.truckId) : "",
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : "",
    })),
  };
}

export async function createLoadAction(
  input: unknown
): Promise<{ ok: true; loadId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateLoadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  let truckObjectId: ObjectId | null = null;
  if (parsed.data.truckId) {
    try {
      truckObjectId = new ObjectId(parsed.data.truckId);
    } catch {
      return { ok: false, error: "Invalid truckId." };
    }
  }

  const doc = {
    status: parsed.data.status,
    pickup: parsed.data.pickup,
    dropoff: parsed.data.dropoff,
    etaHours: parsed.data.etaHours,
    revenueUsd: parsed.data.revenueUsd,
    truckId: parsed.data.truckId ? String(parsed.data.truckId) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("loads").insertOne(doc);

  if (truckObjectId) {
    const truck = await db.collection("trucks").findOne({ _id: truckObjectId }, { projection: { currentLoadId: 1 } });
    const prevLoadId = truck?.currentLoadId ? String((truck as any).currentLoadId) : "";

    if (prevLoadId && prevLoadId !== String(result.insertedId)) {
      await db.collection("loads").updateOne(
        { _id: new ObjectId(prevLoadId) },
        { $set: { truckId: null, updatedAt: new Date() } }
      );
    }

    await db.collection("trucks").updateOne(
      { _id: truckObjectId },
      { $set: { currentLoadId: String(result.insertedId), updatedAt: new Date() } }
    );
  }

  return { ok: true, loadId: String(result.insertedId) };
}

const UpdateLoadSchema = z.object({
  status: z.enum(["planned", "in_transit", "delayed", "delivered"]).optional(),
  pickup: z.string().min(1).max(120).optional(),
  dropoff: z.string().min(1).max(120).optional(),
  etaHours: z.coerce.number().min(0).max(24 * 30).optional(),
  revenueUsd: z.coerce.number().min(0).max(100000000).optional(),
  truckId: z.union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal(""), z.null()]).optional(),
});

export async function updateLoadAction(
  loadId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let loadObjectId: ObjectId;
  try {
    loadObjectId = new ObjectId(String(loadId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const parsed = UpdateLoadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("loads").findOne({ _id: loadObjectId });
  if (!existing) return { ok: false, error: "Not found." };

  let nextTruckId: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "truckId")) {
    const raw = (parsed.data as any).truckId;
    if (raw === "" || raw == null) nextTruckId = null;
    else nextTruckId = String(raw);
  }

  const $set: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.status != null) $set.status = parsed.data.status;
  if (parsed.data.pickup != null) $set.pickup = parsed.data.pickup;
  if (parsed.data.dropoff != null) $set.dropoff = parsed.data.dropoff;
  if (parsed.data.etaHours != null) $set.etaHours = parsed.data.etaHours;
  if (parsed.data.revenueUsd != null) $set.revenueUsd = parsed.data.revenueUsd;
  if (nextTruckId !== undefined) $set.truckId = nextTruckId;

  await db.collection("loads").updateOne({ _id: loadObjectId }, { $set });

  const prevTruckId = (existing as any)?.truckId ? String((existing as any).truckId) : "";
  const nextTruckIdStr = nextTruckId === undefined ? prevTruckId : nextTruckId ? String(nextTruckId) : "";

  if (prevTruckId && prevTruckId !== nextTruckIdStr) {
    try {
      await db.collection("trucks").updateOne(
        { _id: new ObjectId(prevTruckId), currentLoadId: String(loadObjectId) },
        { $set: { currentLoadId: null, updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  }

  if (nextTruckIdStr && nextTruckIdStr !== prevTruckId) {
    try {
      const nextTruck = await db.collection("trucks").findOne(
        { _id: new ObjectId(nextTruckIdStr) },
        { projection: { currentLoadId: 1 } }
      );
      const prevLoadId = nextTruck?.currentLoadId ? String((nextTruck as any).currentLoadId) : "";

      if (prevLoadId && prevLoadId !== String(loadObjectId)) {
        await db.collection("loads").updateOne(
          { _id: new ObjectId(prevLoadId) },
          { $set: { truckId: null, updatedAt: new Date() } }
        );
      }

      await db.collection("trucks").updateOne(
        { _id: new ObjectId(nextTruckIdStr) },
        { $set: { currentLoadId: String(loadObjectId), updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  }

  return { ok: true };
}

export async function deleteLoadAction(loadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let loadObjectId: ObjectId;
  try {
    loadObjectId = new ObjectId(String(loadId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("loads").findOne({ _id: loadObjectId });
  if (!existing) return { ok: true };

  const truckId = (existing as any)?.truckId ? String((existing as any).truckId) : "";

  await db.collection("loads").deleteOne({ _id: loadObjectId });

  if (truckId) {
    try {
      await db.collection("trucks").updateOne(
        { _id: new ObjectId(truckId), currentLoadId: String(loadObjectId) },
        { $set: { currentLoadId: null, updatedAt: new Date() } }
      );
    } catch {
      // ignore
    }
  }

  return { ok: true };
}

// =====================
// Customers
// =====================

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(140),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createCustomerAction(
  input: unknown
): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const doc = {
    name: parsed.data.name,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone,
    notes: parsed.data.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("customers").insertOne(doc);
  return { ok: true, customerId: String(result.insertedId) };
}

const PatchCustomerSchema = z
  .object({
    name: z.string().min(1).max(140).optional(),
    contactEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
    contactPhone: z.union([z.string().max(40), z.literal(""), z.null()]).optional(),
    notes: z.union([z.string().max(2000), z.literal(""), z.null()]).optional(),
  })
  .strict();

export async function updateCustomerAction(
  customerId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let customerObjectId: ObjectId;
  try {
    customerObjectId = new ObjectId(String(customerId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const parsed = PatchCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

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

  if (Object.keys($set).length === 1) return { ok: false, error: "No fields to update." };

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("customers").findOne({ _id: customerObjectId });
  if (!existing) return { ok: false, error: "Not found." };

  await db.collection("customers").updateOne({ _id: customerObjectId }, { $set });
  return { ok: true };
}

export async function deleteCustomerAction(customerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let customerObjectId: ObjectId;
  try {
    customerObjectId = new ObjectId(String(customerId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("customers").findOne({ _id: customerObjectId });
  if (!existing) return { ok: true };

  await Promise.all([
    db.collection("contracts").deleteMany({ customerId: String(customerObjectId) }).catch(() => null),
    db.collection("customers").deleteOne({ _id: customerObjectId }),
  ]);

  return { ok: true };
}

// =====================
// Contracts
// =====================

const CreateContractSchema = z.object({
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  name: z.string().min(1).max(140),
  rateUsd: z.coerce.number().min(0).max(100000000).default(0),
  rateType: z.enum(["flat", "per_mile", "hourly"]).default("flat"),
  notes: z.string().max(2000).optional(),
});

export async function createContractAction(
  input: unknown
): Promise<{ ok: true; contractId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const doc = {
    customerId: parsed.data.customerId,
    name: parsed.data.name,
    rateType: parsed.data.rateType,
    rateUsd: parsed.data.rateUsd,
    notes: parsed.data.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("contracts").insertOne(doc);
  return { ok: true, contractId: String(result.insertedId) };
}

const PatchContractSchema = z
  .object({
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    name: z.string().min(1).max(140).optional(),
    rateUsd: z.coerce.number().min(0).max(100000000).optional(),
    rateType: z.enum(["flat", "per_mile", "hourly"]).optional(),
    notes: z.union([z.string().max(2000), z.literal(""), z.null()]).optional(),
  })
  .strict();

export async function updateContractAction(
  contractId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let contractObjectId: ObjectId;
  try {
    contractObjectId = new ObjectId(String(contractId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const parsed = PatchContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const $set: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.customerId !== undefined) $set.customerId = String(parsed.data.customerId);
  if (parsed.data.name !== undefined) $set.name = String(parsed.data.name);
  if (parsed.data.rateType !== undefined) $set.rateType = String(parsed.data.rateType);
  if (parsed.data.rateUsd !== undefined) $set.rateUsd = Number(parsed.data.rateUsd);
  if (parsed.data.notes !== undefined) {
    const v = parsed.data.notes;
    $set.notes = v === "" || v == null ? null : String(v);
  }

  if (Object.keys($set).length === 1) return { ok: false, error: "No fields to update." };

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("contracts").findOne({ _id: contractObjectId });
  if (!existing) return { ok: false, error: "Not found." };

  await db.collection("contracts").updateOne({ _id: contractObjectId }, { $set });
  return { ok: true };
}

export async function deleteContractAction(contractId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let contractObjectId: ObjectId;
  try {
    contractObjectId = new ObjectId(String(contractId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("contracts").findOne({ _id: contractObjectId });
  if (!existing) return { ok: true };

  await db.collection("contracts").deleteOne({ _id: contractObjectId });
  return { ok: true };
}

// =====================
// Route events
// =====================

const CreateRouteEventSchema = z.object({
  at: z.string().datetime().optional(),
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  loadId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  name: z.enum(["status", "note", "delay", "fuel", "maintenance", "dispatch"]).default("note"),
  message: z.string().min(1).max(2000),
});

export async function createRouteEventAction(
  input: unknown
): Promise<{ ok: true; routeEventId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateRouteEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const at = parsed.data.at ? new Date(parsed.data.at) : new Date();

  const doc = {
    at,
    name: parsed.data.name,
    message: parsed.data.message,
    truckId: parsed.data.truckId ?? null,
    loadId: parsed.data.loadId ?? null,
    createdAt: new Date(),
  };

  const result = await db.collection("routeEvents").insertOne(doc);
  return { ok: true, routeEventId: String(result.insertedId) };
}

const PatchRouteEventSchema = z
  .object({
    at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    truckId: z.union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal(""), z.null()]).optional(),
    loadId: z.union([z.string().regex(/^[0-9a-fA-F]{24}$/), z.literal(""), z.null()]).optional(),
    name: z.enum(["status", "note", "delay", "fuel", "maintenance", "dispatch"]).optional(),
    message: z.string().min(1).max(2000).optional(),
  })
  .strict();

export async function updateRouteEventAction(
  eventId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let eventObjectId: ObjectId;
  try {
    eventObjectId = new ObjectId(String(eventId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const parsed = PatchRouteEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

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

  if (Object.keys($set).length === 1) return { ok: false, error: "No fields to update." };
  if ($set.at instanceof Date && Number.isNaN($set.at.getTime())) return { ok: false, error: "Invalid at timestamp." };

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("routeEvents").findOne({ _id: eventObjectId });
  if (!existing) return { ok: false, error: "Not found." };

  await db.collection("routeEvents").updateOne({ _id: eventObjectId }, { $set });
  return { ok: true };
}

export async function deleteRouteEventAction(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let eventObjectId: ObjectId;
  try {
    eventObjectId = new ObjectId(String(eventId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("routeEvents").findOne({ _id: eventObjectId });
  if (!existing) return { ok: true };

  await db.collection("routeEvents").deleteOne({ _id: eventObjectId });
  return { ok: true };
}

// =====================
// Fuel logs
// =====================

const CreateFuelLogSchema = z.object({
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  at: z.string().datetime().optional(),
  gallons: z.coerce.number().min(0).max(10000).default(0),
  costUsd: z.coerce.number().min(0).max(100000000).default(0),
  odometer: z.coerce.number().min(0).max(100000000).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createFuelLogAction(
  input: unknown
): Promise<{ ok: true; fuelLogId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateFuelLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const at = parsed.data.at ? new Date(parsed.data.at) : new Date();
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Invalid at timestamp." };

  const client = await clientPromise;
  const db = client.db();

  let truckObjectId: ObjectId;
  try {
    truckObjectId = new ObjectId(parsed.data.truckId);
  } catch {
    return { ok: false, error: "Invalid truckId." };
  }

  const doc = {
    truckId: parsed.data.truckId,
    at,
    gallons: parsed.data.gallons,
    costUsd: parsed.data.costUsd,
    odometer: parsed.data.odometer,
    notes: parsed.data.notes,
    createdAt: new Date(),
  };

  const result = await db.collection("fuelLogs").insertOne(doc);

  await db
    .collection("trucks")
    .updateOne({ _id: truckObjectId }, { $set: { updatedAt: new Date() } })
    .catch(() => {
      // ignore
    });

  return { ok: true, fuelLogId: String(result.insertedId) };
}

const PatchFuelLogSchema = z
  .object({
    truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    gallons: z.coerce.number().min(0).max(10000).optional(),
    costUsd: z.coerce.number().min(0).max(100000000).optional(),
    odometer: z.union([z.coerce.number().min(0).max(100000000), z.literal(""), z.null()]).optional(),
    notes: z.union([z.string().max(2000), z.literal(""), z.null()]).optional(),
  })
  .strict();

export async function updateFuelLogAction(
  fuelLogId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let fuelObjectId: ObjectId;
  try {
    fuelObjectId = new ObjectId(String(fuelLogId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const parsed = PatchFuelLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

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

  if (Object.keys($set).length === 1) return { ok: false, error: "No fields to update." };
  if ($set.at instanceof Date && Number.isNaN($set.at.getTime())) return { ok: false, error: "Invalid at timestamp." };

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("fuelLogs").findOne({ _id: fuelObjectId });
  if (!existing) return { ok: false, error: "Not found." };

  await db.collection("fuelLogs").updateOne({ _id: fuelObjectId }, { $set });
  return { ok: true };
}

export async function deleteFuelLogAction(fuelLogId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let fuelObjectId: ObjectId;
  try {
    fuelObjectId = new ObjectId(String(fuelLogId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("fuelLogs").findOne({ _id: fuelObjectId });
  if (!existing) return { ok: true };

  await db.collection("fuelLogs").deleteOne({ _id: fuelObjectId });
  return { ok: true };
}

// =====================
// Maintenance logs
// =====================

const CreateMaintenanceLogSchema = z.object({
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  at: z.string().datetime().optional(),
  kind: z.string().min(1).max(120),
  costUsd: z.coerce.number().min(0).max(100000000).default(0),
  notes: z.string().max(2000).optional(),
});

export async function createMaintenanceLogAction(
  input: unknown
): Promise<{ ok: true; maintenanceLogId: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  const parsed = CreateMaintenanceLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const at = parsed.data.at ? new Date(parsed.data.at) : new Date();

  const client = await clientPromise;
  const db = client.db();

  const doc = {
    truckId: parsed.data.truckId,
    at,
    kind: parsed.data.kind,
    costUsd: parsed.data.costUsd,
    notes: parsed.data.notes,
    createdAt: new Date(),
  };

  const result = await db.collection("maintenanceLogs").insertOne(doc);
  return { ok: true, maintenanceLogId: String(result.insertedId) };
}

const PatchMaintenanceLogSchema = z
  .object({
    truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    at: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    kind: z.string().min(1).max(120).optional(),
    costUsd: z.coerce.number().min(0).max(100000000).optional(),
    notes: z.union([z.string().max(2000), z.literal(""), z.null()]).optional(),
  })
  .strict();

export async function updateMaintenanceLogAction(
  maintenanceLogId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let logObjectId: ObjectId;
  try {
    logObjectId = new ObjectId(String(maintenanceLogId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const parsed = PatchMaintenanceLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const $set: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.truckId !== undefined) $set.truckId = String(parsed.data.truckId);
  if (parsed.data.at !== undefined) {
    const v = parsed.data.at;
    $set.at = v === "" || v == null ? null : new Date(String(v));
  }
  if (parsed.data.kind !== undefined) $set.kind = String(parsed.data.kind);
  if (parsed.data.costUsd !== undefined) $set.costUsd = Number(parsed.data.costUsd);
  if (parsed.data.notes !== undefined) {
    const v = parsed.data.notes;
    $set.notes = v === "" || v == null ? null : String(v);
  }

  if (Object.keys($set).length === 1) return { ok: false, error: "No fields to update." };
  if ($set.at instanceof Date && Number.isNaN($set.at.getTime())) return { ok: false, error: "Invalid at timestamp." };

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("maintenanceLogs").findOne({ _id: logObjectId });
  if (!existing) return { ok: false, error: "Not found." };

  await db.collection("maintenanceLogs").updateOne({ _id: logObjectId }, { $set });
  return { ok: true };
}

export async function deleteMaintenanceLogAction(maintenanceLogId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  if (!clientPromise) return { ok: false, error: "Database not configured." };

  let logObjectId: ObjectId;
  try {
    logObjectId = new ObjectId(String(maintenanceLogId));
  } catch {
    return { ok: false, error: "Invalid id." };
  }

  const client = await clientPromise;
  const db = client.db();

  const existing = await db.collection("maintenanceLogs").findOne({ _id: logObjectId });
  if (!existing) return { ok: true };

  await db.collection("maintenanceLogs").deleteOne({ _id: logObjectId });
  return { ok: true };
}

// =====================
// Drivers (admin)
// =====================

const CreateDriverSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  tempPassword: z.string().min(1).max(200).optional(),
});

export async function createDriverUserAction(
  input: unknown
): Promise<
  | { ok: true; driverId: string; email: string; firstName: string; lastName: string; tempPassword?: string }
  | { ok: false; error: string }
> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  const rl = await rateLimit({
    key: `admin:driver_create:actor:${String((admin as any)._id)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };

  const parsed = CreateDriverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    const tempPassword = parsed.data.tempPassword ?? generateTempPassword();
    const driver = await createUser({
      email: parsed.data.email,
      password: tempPassword,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: "driver",
      mustChangePassword: true,
    });

    await writeAuditEvent({
      name: "admin.driver.create",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((admin as any)._id),
      actorRole: String((admin as any).role),
      subjectUserId: String(driver._id),
      meta: {
        email: driver.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        createdTempPassword: !parsed.data.tempPassword,
      },
    });

    return {
      ok: true,
      driverId: String(driver._id),
      email: driver.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      tempPassword: parsed.data.tempPassword ? undefined : tempPassword,
    };
  } catch (e) {
    await writeAuditEvent({
      name: "admin.driver.create",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((admin as any)._id),
      actorRole: String((admin as any).role),
      meta: {
        email: parsed.data.email,
        error: e instanceof Error ? e.message : "unknown_error",
      },
    });

    return { ok: false, error: e instanceof Error ? e.message : "Unable to create driver." };
  }
}

const PatchDriverSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  isOwnerOperator: z.boolean().optional(),
});

export async function updateDriverUserAction(
  driverId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  const rl = await rateLimit({
    key: `admin:driver_update:actor:${String((admin as any)._id)}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(driverId)) return { ok: false, error: "Invalid driver id." };

  const parsed = PatchDriverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const driverObjectId = new ObjectId(driverId);

  try {
    const client = await clientPromise;
    const db = client.db();

    const existing = await db
      .collection("users")
      .findOne({ _id: driverObjectId, role: "driver" }, { projection: { email: 1 } });

    if (!existing) return { ok: false, error: "Driver not found." };

    await updateDriverProfile(driverObjectId, parsed.data);

    await writeAuditEvent({
      name: "admin.driver.update",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((admin as any)._id),
      actorRole: String((admin as any).role),
      subjectUserId: String(driverObjectId),
      meta: {
        driverId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        isOwnerOperator: parsed.data.isOwnerOperator,
      },
    });

    return { ok: true };
  } catch (e) {
    await writeAuditEvent({
      name: "admin.driver.update",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((admin as any)._id),
      actorRole: String((admin as any).role),
      meta: {
        driverId,
        error: e instanceof Error ? e.message : "unknown_error",
      },
    }).catch(() => {
      // ignore
    });

    return { ok: false, error: e instanceof Error ? e.message : "Unable to update driver." };
  }
}

export async function deleteDriverUserAction(driverId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  const rl = await rateLimit({
    key: `admin:driver_delete:actor:${String((admin as any)._id)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(driverId)) return { ok: false, error: "Invalid driver id." };

  const driverObjectId = new ObjectId(driverId);

  try {
    const client = await clientPromise;
    const db = client.db();

    const driver = await db
      .collection("users")
      .findOne({ _id: driverObjectId, role: "driver" }, { projection: { email: 1 } });

    if (!driver) return { ok: false, error: "Driver not found." };

    const unassignResult = await db.collection("trucks").updateMany(
      { driverUserId: driverId },
      { $set: { driverUserId: null, driverName: null, updatedAt: new Date() } }
    );

    await db.collection("sessions").deleteMany({ userId: driverObjectId }).catch(() => {
      // ignore
    });

    await db.collection("users").deleteOne({ _id: driverObjectId, role: "driver" });

    await writeAuditEvent({
      name: "admin.driver.delete",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((admin as any)._id),
      actorRole: String((admin as any).role),
      subjectUserId: String(driverObjectId),
      meta: {
        email: String((driver as any).email ?? ""),
        unassignedTrucksCount: Number((unassignResult as any).modifiedCount ?? 0),
      },
    });

    return { ok: true };
  } catch (e) {
    await writeAuditEvent({
      name: "admin.driver.delete",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String((admin as any)._id),
      actorRole: String((admin as any).role),
      meta: {
        driverId,
        error: e instanceof Error ? e.message : "unknown_error",
      },
    }).catch(() => {
      // ignore
    });

    return { ok: false, error: e instanceof Error ? e.message : "Unable to delete driver." };
  }
}

const ResetDriverPwSchema = z.object({
  newPassword: z.string().min(1).max(200).optional(),
});

export async function resetDriverPasswordAction(
  driverId: string,
  input: unknown
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  const rl = await rateLimit({
    key: `admin:driver_reset_pw:actor:${String((admin as any)._id)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };

  const parsed = ResetDriverPwSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const user = await findUserById(driverId);
  if (!user) return { ok: false, error: "Driver not found." };
  if (user.role !== "driver") return { ok: false, error: "Can only reset driver passwords." };

  const newPassword = parsed.data.newPassword ?? `TM-${randomToken(10)}!`;
  await setUserPassword(user._id, newPassword);
  await setMustChangePassword(user._id, true);

  await writeAuditEvent({
    name: "admin.driver.reset_password",
    at: new Date(),
    ip,
    userAgent,
    actorUserId: String((admin as any)._id),
    actorRole: String((admin as any).role),
    subjectUserId: String(user._id),
    meta: { createdTempPassword: !parsed.data.newPassword },
  });

  return { ok: true, tempPassword: newPassword };
}

export async function getDriverOverviewAction(
  driverId: string
): Promise<
  | { ok: true; driver: any; truck: any | null; currentLoad: any | null; fuelLogs: any[]; maintenanceLogs: any[]; routeEvents: any[] }
  | { ok: false; error: string }
> {
  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(driverId)) return { ok: false, error: "Invalid driver id." };

  const client = await clientPromise;
  const db = client.db();

  const driverObjectId = new ObjectId(driverId);

  const driver = await db
    .collection("users")
    .findOne(
      { _id: driverObjectId, role: "driver" },
      { projection: { email: 1, firstName: 1, lastName: 1, isOwnerOperator: 1, createdAt: 1 } }
    );

  if (!driver) return { ok: false, error: "Driver not found." };

  const truck = await db.collection("trucks").findOne({ driverUserId: driverId }, { sort: { updatedAt: -1 } });

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
          .find({ truckId }, { sort: { at: -1 }, limit: 25 })
          .toArray()
          .catch(() => [] as any[])
      : Promise.resolve([] as any[]),
    truckId
      ? db
          .collection("maintenanceLogs")
          .find({ truckId }, { sort: { at: -1 }, limit: 25 })
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
        { sort: { at: -1 }, limit: 50 }
      )
      .toArray()
      .catch(() => [] as any[]),
  ]);

  return {
    ok: true,
    driver: toPlain(driver),
    truck: truck ? toPlain(truck) : null,
    currentLoad: currentLoad ? toPlain(currentLoad) : null,
    fuelLogs: toPlain(fuelLogs),
    maintenanceLogs: toPlain(maintenanceLogs),
    routeEvents: toPlain(routeEvents),
  };
}

// =====================
// Leads
// =====================

const UpdateLeadSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  note: z.string().max(2000).optional(),
});

export async function updateLeadAction(
  kind: "quotes" | "drivers",
  leadId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(leadId)) return { ok: false, error: "Invalid lead id." };

  const parsed = UpdateLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const leadObjectId = new ObjectId(leadId);

  const $set: Record<string, any> = {
    updatedAt: new Date(),
    ownerUserId: String((admin as any)._id),
  };

  if (parsed.data.status) $set.status = parsed.data.status;

  if (parsed.data.nextFollowUpAt !== undefined) {
    $set.nextFollowUpAt = parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null;
  }

  const update: any = { $set };

  if (parsed.data.note && parsed.data.note.trim().length > 0) {
    update.$push = {
      notes: {
        at: new Date(),
        actorUserId: String((admin as any)._id),
        message: parsed.data.note.trim(),
      },
    };
  }

  await db.collection(kind === "quotes" ? "leads_quotes" : "leads_drivers").updateOne({ _id: leadObjectId }, update as any);

  return { ok: true };
}

export async function deleteLeadAction(
  kind: "quotes" | "drivers",
  leadId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(leadId)) return { ok: false, error: "Invalid lead id." };

  const client = await clientPromise;
  const db = client.db();
  const leadObjectId = new ObjectId(leadId);
  const collection = kind === "quotes" ? "leads_quotes" : "leads_drivers";

  const existing = await db.collection(collection).findOne({ _id: leadObjectId }, { projection: { isArchived: 1 } });
  if (!existing) return { ok: true };
  if ((existing as any).isArchived) return { ok: true };

  await db.collection(collection).updateOne(
    { _id: leadObjectId },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: String((admin as any)._id),
        updatedAt: new Date(),
      },
      $push: {
        notes: {
          at: new Date(),
          actorUserId: String((admin as any)._id),
          message: "Archived from admin inbox.",
        },
      },
    } as any
  );

  return { ok: true };
}

export async function restoreLeadAction(
  kind: "quotes" | "drivers",
  leadId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(leadId)) return { ok: false, error: "Invalid lead id." };

  const client = await clientPromise;
  const db = client.db();
  const leadObjectId = new ObjectId(leadId);
  const collection = kind === "quotes" ? "leads_quotes" : "leads_drivers";

  const existing = await db.collection(collection).findOne({ _id: leadObjectId }, { projection: { isArchived: 1 } });
  if (!existing) return { ok: true };
  if (!(existing as any).isArchived) return { ok: true };

  await db.collection(collection).updateOne(
    { _id: leadObjectId },
    {
      $set: {
        isArchived: false,
        updatedAt: new Date(),
      },
      $unset: {
        archivedAt: "",
        archivedByUserId: "",
      },
      $push: {
        notes: {
          at: new Date(),
          actorUserId: String((admin as any)._id),
          message: "Restored to admin inbox.",
        },
      },
    } as any
  );

  return { ok: true };
}

const ConvertQuoteLeadSchema = z.object({
  createLoad: z.boolean().default(true),
  contractName: z.string().min(1).max(140).optional(),
  rateType: z.enum(["flat", "per_mile", "hourly"]).default("flat"),
  rateUsd: z.coerce.number().min(0).max(100000000).default(0),
});

export async function convertQuoteLeadAction(
  leadId: string,
  input: unknown
): Promise<{ ok: true; customerId: string; contractId: string; loadId: string | null } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(leadId)) return { ok: false, error: "Invalid lead id." };

  const parsed = ConvertQuoteLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const leadObjectId = new ObjectId(leadId);
  const lead = await db.collection("leads_quotes").findOne({ _id: leadObjectId });
  if (!lead) return { ok: false, error: "Lead not found." };

  if ((lead as any).convertedAt) return { ok: false, error: "Lead already converted." };

  const company = String((lead as any).company ?? "").trim();
  const contactName = String((lead as any).name ?? "").trim();
  const customerName = company.length > 0 ? company : contactName.length > 0 ? contactName : "Web Lead";

  const email = (lead as any).email ? String((lead as any).email) : undefined;
  const phone = (lead as any).phone ? String((lead as any).phone) : undefined;
  const pickup = String((lead as any).pickupLocation ?? "").trim();
  const dropoff = String((lead as any).dropoffLocation ?? "").trim();

  const customerDoc = {
    name: customerName,
    contactEmail: email,
    contactPhone: phone,
    notes: "Created from quote lead.",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const customerResult = await db.collection("customers").insertOne(customerDoc);
  const customerId = String(customerResult.insertedId);

  const contractDoc = {
    customerId,
    name: parsed.data.contractName ?? (pickup && dropoff ? `Quote: ${pickup} → ${dropoff}` : `Quote Lead ${leadId}`),
    rateType: parsed.data.rateType,
    rateUsd: parsed.data.rateUsd,
    notes: "Created from quote lead.",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const contractResult = await db.collection("contracts").insertOne(contractDoc);
  const contractId = String(contractResult.insertedId);

  let loadId: string | null = null;
  if (parsed.data.createLoad) {
    const loadDoc = {
      status: "planned",
      pickup,
      dropoff,
      etaHours: 0,
      revenueUsd: parsed.data.rateUsd,
      truckId: null,
      customerId,
      contractId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const loadResult = await db.collection("loads").insertOne(loadDoc);
    loadId = String(loadResult.insertedId);
  }

  await db.collection("leads_quotes").updateOne(
    { _id: leadObjectId },
    ({
      $set: {
        status: "converted",
        convertedAt: new Date(),
        conversion: { customerId, contractId, loadId },
        ownerUserId: String((admin as any)._id),
      },
      $push: {
        notes: {
          at: new Date(),
          actorUserId: String((admin as any)._id),
          message: "Converted to customer/contract" + (loadId ? " + load" : ""),
        },
      },
    } as any)
  );

  return { ok: true, customerId, contractId, loadId };
}

const ConvertDriverLeadSchema = z.object({
  tempPassword: z.string().min(12).max(200).optional(),
});

function generateDriverLeadTempPassword() {
  const raw = crypto.randomBytes(18).toString("base64url");
  return `${raw}A1!`;
}

export async function convertDriverLeadAction(
  leadId: string,
  input: unknown
): Promise<{ ok: true; driverUserId: string; email: string; tempPassword: string } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const auth = await requireAdminOrError();
  if (!auth.ok) return auth;
  const admin = auth.admin;

  if (!clientPromise) return { ok: false, error: "Database not configured." };
  if (!/^[0-9a-fA-F]{24}$/.test(leadId)) return { ok: false, error: "Invalid lead id." };

  const parsed = ConvertDriverLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const client = await clientPromise;
  const db = client.db();

  const leadObjectId = new ObjectId(leadId);
  const lead = await db.collection("leads_drivers").findOne({ _id: leadObjectId });
  if (!lead) return { ok: false, error: "Lead not found." };

  if ((lead as any).convertedAt) return { ok: false, error: "Lead already converted." };

  const email = String((lead as any).email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Driver lead missing email." };

  const tempPassword = parsed.data.tempPassword ?? generateDriverLeadTempPassword();

  const rawName = String((lead as any).fullName ?? "").trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ? parts[0] : undefined;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;

  const driver = await createUser({
    email,
    password: tempPassword,
    firstName,
    lastName,
    role: "driver",
    mustChangePassword: true,
  });

  await db.collection("leads_drivers").updateOne(
    { _id: leadObjectId },
    ({
      $set: {
        status: "converted",
        convertedAt: new Date(),
        conversion: { driverUserId: String(driver._id) },
        ownerUserId: String((admin as any)._id),
      },
      $push: {
        notes: {
          at: new Date(),
          actorUserId: String((admin as any)._id),
          message: "Converted to driver user.",
        },
      },
    } as any)
  );

  return { ok: true, driverUserId: String(driver._id), email: driver.email, tempPassword };
}
