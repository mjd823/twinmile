import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { createUser } from "@/lib/auth/users";
import { isSameOrigin } from "@/lib/security/csrf";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const CreateDriverSchema = z.object({
  email: z.string().email(),
  tempPassword: z.string().min(12).max(200),
});

export async function POST(req: Request) {
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
    key: `admin:driver_create:actor:${String(admin._id)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateDriverSchema.safeParse(body);
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

  try {
    const driver = await createUser({
      email: parsed.data.email,
      password: parsed.data.tempPassword,
      role: "driver",
      mustChangePassword: true,
    });

    await writeAuditEvent({
      name: "admin.driver.create",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(admin._id),
      actorRole: String(admin.role),
      subjectUserId: String(driver._id),
      meta: { email: driver.email },
    });

    return NextResponse.json(
      { ok: true, driverId: String(driver._id), email: driver.email },
      { status: 200 }
    );
  } catch (e) {
    await writeAuditEvent({
      name: "admin.driver.create",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(admin._id),
      actorRole: String(admin.role),
      meta: {
        email: parsed.data.email,
        error: e instanceof Error ? e.message : "unknown_error",
      },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to create driver." },
      { status: 400 }
    );
  }
}
