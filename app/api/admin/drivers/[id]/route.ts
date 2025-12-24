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

 export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
     key: `admin:driver_update:actor:${String(admin._id)}`,
     limit: 120,
     windowMs: 60 * 60 * 1000,
   });
   if (!rl.ok) {
     return NextResponse.json(
       { error: "Too many requests. Try again later." },
       { status: 429 }
     );
   }

   if (!clientPromise) {
     return NextResponse.json({ error: "Database not configured." }, { status: 500 });
   }

   const { id } = await ctx.params;
   if (!/^[0-9a-fA-F]{24}$/.test(id)) {
     return NextResponse.json({ error: "Invalid driver id." }, { status: 400 });
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

   const driverObjectId = new ObjectId(id);

   try {
     const client = await clientPromise;
     const db = client.db();

     const existing = await db
       .collection("users")
       .findOne({ _id: driverObjectId, role: "driver" }, { projection: { email: 1 } });

     if (!existing) {
       return NextResponse.json({ error: "Driver not found." }, { status: 404 });
     }

     await updateDriverProfile(driverObjectId, parsed.data);

     await writeAuditEvent({
       name: "admin.driver.update",
       at: new Date(),
       ip,
       userAgent,
       actorUserId: String(admin._id),
       actorRole: String(admin.role),
       subjectUserId: String(driverObjectId),
       meta: {
         driverId: id,
         firstName: parsed.data.firstName,
         lastName: parsed.data.lastName,
         isOwnerOperator: parsed.data.isOwnerOperator,
       },
     });

     return NextResponse.json({ ok: true }, { status: 200 });
   } catch (e) {
     await writeAuditEvent({
       name: "admin.driver.update",
       at: new Date(),
       ip,
       userAgent,
       actorUserId: String(admin._id),
       actorRole: String(admin.role),
       meta: {
         driverId: id,
         error: e instanceof Error ? e.message : "unknown_error",
       },
     }).catch(() => {
       // ignore
     });

     return NextResponse.json(
       { error: e instanceof Error ? e.message : "Unable to update driver." },
       { status: 400 }
     );
   }
 }

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    key: `admin:driver_delete:actor:${String(admin._id)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json({ error: "Invalid driver id." }, { status: 400 });
  }

  const driverObjectId = new ObjectId(id);

  try {
    const client = await clientPromise;
    const db = client.db();

    const driver = await db
      .collection("users")
      .findOne({ _id: driverObjectId, role: "driver" }, { projection: { email: 1 } });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }

    const unassignResult = await db.collection("trucks").updateMany(
      { driverUserId: id },
      {
        $set: {
          driverUserId: null,
          driverName: null,
          updatedAt: new Date(),
        },
      }
    );

    await db.collection("sessions").deleteMany({ userId: driverObjectId }).catch(() => {
      // ignore
    });

    await db.collection("users").deleteOne({ _id: driverObjectId, role: "driver" });

    await writeAuditEvent({
      name: "admin.driver.delete",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(admin._id),
      actorRole: String(admin.role),
      subjectUserId: String(driverObjectId),
      meta: {
        email: String((driver as any).email ?? ""),
        unassignedTrucksCount: Number(unassignResult.modifiedCount ?? 0),
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    await writeAuditEvent({
      name: "admin.driver.delete",
      at: new Date(),
      ip,
      userAgent,
      actorUserId: String(admin._id),
      actorRole: String(admin.role),
      meta: {
        driverId: id,
        error: e instanceof Error ? e.message : "unknown_error",
      },
    }).catch(() => {
      // ignore
    });

    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to delete driver." },
      { status: 400 }
    );
  }
}
