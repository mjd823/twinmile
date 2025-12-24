import clientPromise from "@/lib/mongodb";

export type AuditEventName =
  | "auth.login.attempt"
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.password.change.attempt"
  | "auth.password.change.success"
  | "auth.password.change.failure"
  | "admin.driver.create"
  | "admin.driver.reset_password";

export type AuditEvent = {
  name: AuditEventName;
  at: Date;
  actorUserId?: string;
  actorRole?: string;
  subjectUserId?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
};

export async function writeAuditEvent(event: AuditEvent) {
  if (!clientPromise) return;
  const client = await clientPromise;
  const db = client.db();

  await db.collection("auditLogs").insertOne({
    ...event,
    at: event.at ?? new Date(),
  });
}
