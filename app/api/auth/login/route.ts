import { NextResponse } from "next/server";
import { z } from "zod";

import { createSession } from "@/lib/auth/session";
import { findUserByEmail, verifyUserPassword } from "@/lib/auth/users";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "driver"]),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const pre = await rateLimit({ key: `auth:login:ip:${ip}`, limit: 25, windowMs: 15 * 60 * 1000 });
  if (!pre.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);

  if (!parsed.success) {
    await writeAuditEvent({
      name: "auth.login.failure",
      at: new Date(),
      ip,
      userAgent,
      meta: { reason: "invalid_payload" },
    });
    return NextResponse.json(
      { error: "Invalid login." },
      {
        status: 400,
      }
    );
  }

  await writeAuditEvent({
    name: "auth.login.attempt",
    at: new Date(),
    ip,
    userAgent,
    meta: { email: parsed.data.email, role: parsed.data.role },
  });

  const scoped = await rateLimit({
    key: `auth:login:ip_email:${ip}:${parsed.data.email.toLowerCase()}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!scoped.ok) {
    await writeAuditEvent({
      name: "auth.login.failure",
      at: new Date(),
      ip,
      userAgent,
      meta: { email: parsed.data.email, role: parsed.data.role, reason: "rate_limited" },
    });
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    await writeAuditEvent({
      name: "auth.login.failure",
      at: new Date(),
      ip,
      userAgent,
      meta: { email: parsed.data.email, role: parsed.data.role, reason: "invalid_credentials" },
    });
    return NextResponse.json({ error: "Invalid login." }, { status: 401 });
  }

  if (user.role !== parsed.data.role) {
    await writeAuditEvent({
      name: "auth.login.failure",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(user._id),
      actorRole: String(user.role),
      meta: { email: parsed.data.email, role: parsed.data.role, reason: "role_mismatch" },
    });
    return NextResponse.json({ error: "Invalid login." }, { status: 401 });
  }

  const ok = verifyUserPassword(user, parsed.data.password);
  if (!ok) {
    await writeAuditEvent({
      name: "auth.login.failure",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(user._id),
      actorRole: String(user.role),
      meta: { email: parsed.data.email, role: parsed.data.role, reason: "invalid_credentials" },
    });
    return NextResponse.json({ error: "Invalid login." }, { status: 401 });
  }

  await createSession({
    userId: user._id,
    role: user.role,
    ttlDays: 14,
    mustChangePassword: Boolean((user as any).mustChangePassword),
  });

  await writeAuditEvent({
    name: "auth.login.success",
    at: new Date(),
    ip,
    userAgent,
    actorUserId: String(user._id),
    actorRole: String(user.role),
    meta: { email: parsed.data.email, role: parsed.data.role },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
