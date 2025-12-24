import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { updateDriverProfile } from "@/lib/auth/users";
import { isSameOrigin } from "@/lib/security/csrf";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const PatchSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  isOwnerOperator: z.boolean().optional(),
});

export async function GET() {
  const driver = await requireRole("driver");
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const client = await clientPromise;
  const db = client.db();

  const userId = String((driver as any)._id);
  if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(userId), role: "driver" }, { projection: { email: 1, firstName: 1, lastName: 1, isOwnerOperator: 1 } });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      profile: {
        email: String((user as any).email ?? ""),
        firstName: (user as any).firstName ? String((user as any).firstName) : "",
        lastName: (user as any).lastName ? String((user as any).lastName) : "",
        isOwnerOperator: Boolean((user as any).isOwnerOperator),
      },
    },
    { status: 200, headers: { "cache-control": "no-store, max-age=0" } }
  );
}

export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const driver = await requireRole("driver");
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rl = await rateLimit({
    key: `driver:profile_update:user:${String((driver as any)._id)}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const userId = String((driver as any)._id);
  if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to update profile." },
      { status: 400 }
    );
  }
}
