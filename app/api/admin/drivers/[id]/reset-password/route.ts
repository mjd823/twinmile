import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/crypto";
import { findUserById, setMustChangePassword, setUserPassword } from "@/lib/auth/users";
import { isSameOrigin } from "@/lib/security/csrf";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const Schema = z.object({
  newPassword: z.string().min(12).max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const admin = await requireRole("admin");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rl = await rateLimit({
    key: `admin:driver_reset_pw:actor:${String(admin._id)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
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

  const user = await findUserById(id);
  if (!user) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }

  if (user.role !== "driver") {
    return NextResponse.json({ error: "Can only reset driver passwords." }, { status: 400 });
  }

  const newPassword = parsed.data.newPassword ?? `TM-${randomToken(10)}!`;
  await setUserPassword(user._id, newPassword);
  await setMustChangePassword(user._id, true);

  await writeAuditEvent({
    name: "admin.driver.reset_password",
    at: new Date(),
    ip,
    userAgent,
    actorUserId: String(admin._id),
    actorRole: String(admin.role),
    subjectUserId: String(user._id),
    meta: { createdTempPassword: !parsed.data.newPassword },
  });

  return NextResponse.json({ ok: true, tempPassword: newPassword }, { status: 200 });
}
