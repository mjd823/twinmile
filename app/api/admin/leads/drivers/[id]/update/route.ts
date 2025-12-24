import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const UpdateDriverLeadSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  note: z.string().max(2000).optional(),
});

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
  const parsed = UpdateDriverLeadSchema.safeParse(body);
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

  const $set: Record<string, any> = {
    updatedAt: new Date(),
    ownerUserId: String((admin as any)._id),
  };

  if (parsed.data.status) $set.status = parsed.data.status;

  if (parsed.data.nextFollowUpAt !== undefined) {
    $set.nextFollowUpAt = parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null;
  }

  const update: any = { $set };

  if (parsed.data.note && parsed.data.note.trim().length > 0) {
    update.$push = {
      notes: {
        at: new Date(),
        actorUserId: String((admin as any)._id),
        message: parsed.data.note.trim(),
      },
    };
  }

  await db.collection("leads_drivers").updateOne({ _id: leadObjectId }, update as any);

  return NextResponse.json({ ok: true }, { status: 200 });
}
