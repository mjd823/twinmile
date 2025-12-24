import { NextResponse } from "next/server";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateMaintenanceLogSchema = z.object({
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  at: z.string().datetime().optional(),
  kind: z.string().min(1).max(120),
  costUsd: z.coerce.number().min(0).max(100000000).default(0),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const client = await clientPromise;
  const db = client.db();

  const logs = await db
    .collection("maintenanceLogs")
    .find({}, { sort: { at: -1 }, limit: 500 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      maintenanceLogs: logs.map((l: any) => ({
        id: String(l._id),
        truckId: l.truckId ? String(l.truckId) : "",
        at: l.at instanceof Date ? l.at.toISOString() : "",
        kind: String(l.kind ?? ""),
        costUsd: Number(l.costUsd ?? 0),
        notes: l.notes ? String(l.notes) : "",
      })),
    },
    { status: 200, headers: { "cache-control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = CreateMaintenanceLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  const at = parsed.data.at ? new Date(parsed.data.at) : new Date();

  const client = await clientPromise;
  const db = client.db();

  const doc = {
    truckId: parsed.data.truckId,
    at,
    kind: parsed.data.kind,
    costUsd: parsed.data.costUsd,
    notes: parsed.data.notes,
    createdAt: new Date(),
  };

  const result = await db.collection("maintenanceLogs").insertOne(doc);

  return NextResponse.json({ ok: true, maintenanceLogId: String(result.insertedId) }, { status: 200 });
}
