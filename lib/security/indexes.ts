import type { Db } from "mongodb";

let ensured: Promise<void> | null = null;

export function ensureIndexes(db: Db) {
  if (ensured) return ensured;

  ensured = (async () => {
    await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
    await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    await db.collection("rateLimits").createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });

    await db.collection("trucks").createIndex({ updatedAt: -1 });
    await db.collection("trucks").createIndex({ status: 1, updatedAt: -1 });
    await db.collection("trucks").createIndex({ driverUserId: 1, updatedAt: -1 });

    await db.collection("loads").createIndex({ createdAt: -1 });
    await db.collection("loads").createIndex({ status: 1, createdAt: -1 });
    await db.collection("loads").createIndex({ truckId: 1, createdAt: -1 });

    await db.collection("stops").createIndex({ loadId: 1, order: 1 });

    await db.collection("routeEvents").createIndex({ loadId: 1, at: -1 });
    await db.collection("routeEvents").createIndex({ truckId: 1, at: -1 });

    await db.collection("customers").createIndex({ name: 1 });
    await db.collection("contracts").createIndex({ customerId: 1, createdAt: -1 });

    await db.collection("fuelLogs").createIndex({ truckId: 1, at: -1 });
    await db.collection("maintenanceLogs").createIndex({ truckId: 1, at: -1 });

    await db.collection("leads_quotes").createIndex({ createdAt: -1 });
    await db.collection("leads_quotes").createIndex({ status: 1, createdAt: -1 });
    await db.collection("leads_drivers").createIndex({ createdAt: -1 });
    await db.collection("leads_drivers").createIndex({ status: 1, createdAt: -1 });

    await db.collection("lease_agreements").createIndex({ createdAt: -1 });
    await db.collection("lease_agreements").createIndex({ status: 1, createdAt: -1 });

    const days = Number(process.env.AUDIT_LOG_TTL_DAYS ?? 180);
    if (Number.isFinite(days) && days > 0) {
      await db.collection("auditLogs").createIndex(
        { at: 1 },
        { expireAfterSeconds: Math.floor(days * 24 * 60 * 60) }
      );
    }
  })();

  return ensured;
}
