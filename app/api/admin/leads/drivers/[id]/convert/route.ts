import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import crypto from "crypto";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";
import { createUser } from "@/lib/auth/users";

const ConvertDriverLeadSchema = z.object({
  // Optional override; if omitted we generate one.
  tempPassword: z.string().min(12).max(200).optional(),
});

function generateTempPassword() {
  // 18 bytes -> 24 chars base64url-ish; then add a suffix for complexity.
  const raw = crypto.randomBytes(18).toString("base64url");
  return `${raw}A1!`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = await requireRole("admin");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ConvertDriverLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db();

  const leadObjectId = new ObjectId(id);
  const lead = await db.collection("leads_drivers").findOne({ _id: leadObjectId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if ((lead as any).convertedAt) {
    return NextResponse.json({ error: "Lead already converted." }, { status: 409 });
  }

  const email = String((lead as any).email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Driver lead missing email." }, { status: 400 });
  }

  const tempPassword = parsed.data.tempPassword ?? generateTempPassword();

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
        conversion: {
          driverUserId: String(driver._id),
        },
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

  return NextResponse.json(
    {
      ok: true,
      driverUserId: String(driver._id),
      email: driver.email,
      tempPassword,
    },
    { status: 200 }
  );
}
