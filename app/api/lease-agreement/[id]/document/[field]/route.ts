import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; field: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, field } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const validFields = ["cdl", "coi", "registration", "w9", "dotPhysical"];
    if (!validFields.includes(field)) {
      return NextResponse.json({ error: "Invalid document field" }, { status: 400 });
    }

    if (!clientPromise) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();

    const agreement = await db
      .collection("lease_agreements")
      .findOne(
        { _id: new ObjectId(id) },
        { projection: { [`documents.${field}`]: 1 } }
      );

    if (!agreement?.documents?.[field]) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const doc = agreement.documents[field];
    const buffer = Buffer.from(doc.data, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": doc.type,
        "Content-Disposition": `inline; filename="${doc.name}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[lease-agreement/document] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
