import { NextResponse } from "next/server";

import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";

function fullName(u: { firstName?: string; lastName?: string; email?: string }) {
  const name = `${String(u.firstName ?? "").trim()} ${String(u.lastName ?? "").trim()}`.trim();
  return name || String(u.email ?? "").trim();
}

function toPlain(value: any): any {
  if (value == null) return value;

  if (Array.isArray(value)) return value.map(toPlain);

  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") {
      try {
        return value.toHexString();
      } catch {
        return String(value);
      }
    }

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = toPlain(v);
    }
    return out;
  }

  return value;
}

export async function GET() {
  const admin = await requireRole("admin");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!clientPromise) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const client = await clientPromise;
  const db = client.db();

  const [trucks, loads] = await Promise.all([
    db
      .collection("trucks")
      .find({}, { sort: { updatedAt: -1 }, limit: 100 })
      .toArray()
      .catch(() => [] as any[]),
    db
      .collection("loads")
      .find({}, { sort: { createdAt: -1 }, limit: 100 })
      .toArray()
      .catch(() => [] as any[]),
  ]);

  const driverUserIds = Array.from(
    new Set(
      (trucks ?? [])
        .map((t: any) => (t?.driverUserId ? String(t.driverUserId) : ""))
        .filter(Boolean)
    )
  );

  const driverObjectIds = driverUserIds
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ObjectId[];

  const driverUsers = driverObjectIds.length
    ? await db
        .collection("users")
        .find(
          { _id: { $in: driverObjectIds } },
          { projection: { email: 1, firstName: 1, lastName: 1 } }
        )
        .toArray()
        .catch(() => [] as any[])
    : ([] as any[]);

  const driverById = new Map<string, any>();
  for (const u of driverUsers) {
    const id = u?._id ? String(u._id) : "";
    if (id) driverById.set(id, u);
  }

  for (const t of trucks as any[]) {
    const did = t?.driverUserId ? String(t.driverUserId) : "";
    if (!did) continue;
    const u = driverById.get(did);
    if (!u) continue;
    const name = fullName(u);
    if (name) t.driverName = name;
  }

  return NextResponse.json(
    {
      ok: true,
      trucks: toPlain(trucks),
      loads: toPlain(loads),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
