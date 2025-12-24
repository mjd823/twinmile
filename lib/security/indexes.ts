import type { Db } from "mongodb";

let ensured: Promise<void> | null = null;

export function ensureIndexes(db: Db) {
  if (ensured) return ensured;

  ensured = (async () => {
    await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
    await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    await db.collection("rateLimits").createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });

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
