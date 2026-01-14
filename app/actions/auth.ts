"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { createSession, clearSession, getAuthUser } from "@/lib/auth/session";
import { findUserByEmail, findUserById, setUserPassword, verifyUserPassword } from "@/lib/auth/users";
import { writeAuditEvent } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";

import { getClientIpFromHeaders, getUserAgentFromHeaders, isSameOriginFromHeaders } from "@/app/actions/_request";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "driver"]),
});

export async function loginAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const pre = await rateLimit({ key: `auth:login:ip:${ip}`, limit: 25, windowMs: 15 * 60 * 1000 });
  if (!pre.ok) {
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    await writeAuditEvent({
      name: "auth.login.failure",
      at: new Date(),
      ip,
      userAgent,
      meta: { reason: "invalid_payload" },
    });
    return { ok: false, error: "Invalid login." };
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
    return { ok: false, error: "Too many attempts. Try again later." };
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
    return { ok: false, error: "Invalid login." };
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
    return { ok: false, error: "Invalid login." };
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
    return { ok: false, error: "Invalid login." };
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

  return { ok: true };
}

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(1).max(200),
});

export async function changePasswordAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return { ok: false, error: "Forbidden." };

  const ip = await getClientIpFromHeaders();
  const userAgent = await getUserAgentFromHeaders();

  const authUser = await getAuthUser();
  if (!authUser) return { ok: false, error: "Unauthorized." };

  await writeAuditEvent({
    name: "auth.password.change.attempt",
    at: new Date(),
    ip,
    userAgent,
    actorUserId: String(authUser._id),
    actorRole: String(authUser.role),
  });

  const rl = await rateLimit({
    key: `auth:pwchange:user:${String(authUser._id)}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    await writeAuditEvent({
      name: "auth.password.change.failure",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(authUser._id),
      actorRole: String(authUser.role),
      meta: { reason: "rate_limited" },
    });
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  const parsed = ChangePasswordSchema.safeParse(input);
  if (!parsed.success) {
    await writeAuditEvent({
      name: "auth.password.change.failure",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(authUser._id),
      actorRole: String(authUser.role),
      meta: { reason: "invalid_payload" },
    });
    return { ok: false, error: "Invalid request." };
  }

  const user = await findUserById(authUser._id);
  if (!user) {
    await writeAuditEvent({
      name: "auth.password.change.failure",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(authUser._id),
      actorRole: String(authUser.role),
      meta: { reason: "user_not_found" },
    });
    return { ok: false, error: "Unauthorized." };
  }

  const ok = verifyUserPassword(user, parsed.data.currentPassword);
  if (!ok) {
    await writeAuditEvent({
      name: "auth.password.change.failure",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(authUser._id),
      actorRole: String(authUser.role),
      meta: { reason: "invalid_current_password" },
    });
    return { ok: false, error: "Current password is incorrect." };
  }

  await setUserPassword(user._id, parsed.data.newPassword);

  const jar = await cookies();
  jar.set({
    name: "tm_mcpw",
    value: "0",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  await writeAuditEvent({
    name: "auth.password.change.success",
    at: new Date(),
    ip,
    userAgent,
    actorUserId: String(authUser._id),
    actorRole: String(authUser.role),
  });

  return { ok: true };
}

export async function logoutAction(_formData: FormData): Promise<void> {
  const sameOrigin = await isSameOriginFromHeaders();
  if (!sameOrigin) return;
  await clearSession();
}

export async function meAction(): Promise<{ loggedIn: boolean; role: "admin" | "driver" | null; portalHref: string | null }> {
  const jar = await cookies();
  const session = jar.get("tm_session")?.value;
  const role = jar.get("tm_role")?.value;

  const portalHref = role === "admin" ? "/admin" : role === "driver" ? "/driver" : null;

  return {
    loggedIn: Boolean(session && portalHref),
    role: role === "admin" || role === "driver" ? role : null,
    portalHref,
  };
}
