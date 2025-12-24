import { NextResponse } from "next/server";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const CreateRouteEventSchema = z.object({
  at: z.string().datetime().optional(),
  truckId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  loadId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  name: z.enum(["status", "note", "delay", "fuel", "maintenance", "dispatch"]).default("note"),
  message: z.string().min(1).max(2000),
});

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });

  const client = await clientPromise;
  const db = client.db();

  const events = await db
    .collection("routeEvents")
    .find({}, { sort: { at: -1 }, limit: 500 })
    .toArray();

  return NextResponse.json(
    {
      ok: true,
      routeEvents: events.map((e: any) => ({
        id: String(e._id),
        at: e.at instanceof Date ? e.at.toISOString() : "",
        name: String(e.name ?? "note"),
        message: String(e.message ?? ""),
        truckId: e.truckId ? String(e.truckId) : "",
        loadId: e.loadId ? String(e.loadId) : "",
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
  const parsed = CreateRouteEventSchema.safeParse(body);
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

  const at = parsed.data.at ? new Date(parsed.data.at) : new Date();

  const doc = {
    at,
    name: parsed.data.name,
    message: parsed.data.message,
    truckId: parsed.data.truckId ?? null,
    loadId: parsed.data.loadId ?? null,
    createdAt: new Date(),
  };

  const result = await db.collection("routeEvents").insertOne(doc);

  return NextResponse.json({ ok: true, routeEventId: String(result.insertedId) }, { status: 200 });
}
