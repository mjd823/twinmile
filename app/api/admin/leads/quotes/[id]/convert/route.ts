import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

const ConvertQuoteLeadSchema = z.object({
  createLoad: z.boolean().default(true),
  contractName: z.string().min(1).max(140).optional(),
  rateType: z.enum(["flat", "per_mile", "hourly"]).default("flat"),
  rateUsd: z.coerce.number().min(0).max(100000000).default(0),
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
  const parsed = ConvertQuoteLeadSchema.safeParse(body);
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
  const lead = await db.collection("leads_quotes").findOne({ _id: leadObjectId });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if ((lead as any).convertedAt) {
    return NextResponse.json({ error: "Lead already converted." }, { status: 409 });
  }

  const company = String((lead as any).company ?? "").trim();
  const contactName = String((lead as any).name ?? "").trim();
  const customerName = company.length > 0 ? company : contactName.length > 0 ? contactName : "Web Lead";

  const email = (lead as any).email ? String((lead as any).email) : undefined;
  const phone = (lead as any).phone ? String((lead as any).phone) : undefined;
  const pickup = String((lead as any).pickupLocation ?? "").trim();
  const dropoff = String((lead as any).dropoffLocation ?? "").trim();

  const customerDoc = {
    name: customerName,
    contactEmail: email,
    contactPhone: phone,
    notes: "Created from quote lead.",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const customerResult = await db.collection("customers").insertOne(customerDoc);
  const customerId = String(customerResult.insertedId);

  const contractDoc = {
    customerId,
    name:
      parsed.data.contractName ??
      (pickup && dropoff ? `Quote: ${pickup} → ${dropoff}` : `Quote Lead ${id}`),
    rateType: parsed.data.rateType,
    rateUsd: parsed.data.rateUsd,
    notes: "Created from quote lead.",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const contractResult = await db.collection("contracts").insertOne(contractDoc);
  const contractId = String(contractResult.insertedId);

  let loadId: string | null = null;
  if (parsed.data.createLoad) {
    const loadDoc = {
      status: "planned",
      pickup,
      dropoff,
      etaHours: 0,
      revenueUsd: parsed.data.rateUsd,
      truckId: null,
      customerId,
      contractId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const loadResult = await db.collection("loads").insertOne(loadDoc);
    loadId = String(loadResult.insertedId);
  }

  await db.collection("leads_quotes").updateOne(
    { _id: leadObjectId },
    ({
      $set: {
        status: "converted",
        convertedAt: new Date(),
        conversion: {
          customerId,
          contractId,
          loadId,
        },
        ownerUserId: String((admin as any)._id),
      },
      $push: {
        notes: {
          at: new Date(),
          actorUserId: String((admin as any)._id),
          message: "Converted to customer/contract" + (loadId ? " + load" : ""),
        },
      },
    } as any)
  );

  return NextResponse.json(
    {
      ok: true,
      customerId,
      contractId,
      loadId,
    },
    { status: 200 }
  );
}
