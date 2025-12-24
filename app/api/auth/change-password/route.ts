import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";

import { getAuthUser } from "@/lib/auth/session";
import { findUserById, setUserPassword, verifyUserPassword } from "@/lib/auth/users";
import { isSameOrigin } from "@/lib/security/csrf";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const Schema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(12).max(200),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
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
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
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
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
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

  return NextResponse.json({ ok: true }, { status: 200 });
}
