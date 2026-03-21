import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getClientIp } from "@/lib/security/request";
import { isSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB per file
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

const REQUIRED_FILES = ["cdl", "coi", "registration", "w9", "dotPhysical"] as const;

const FILE_LABELS: Record<string, string> = {
  cdl: "Driver's License / CDL",
  coi: "Certificate of Insurance (COI)",
  registration: "Vehicle Registration",
  w9: "W-9 Form",
  dotPhysical: "DOT Physical",
};

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

function getFileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    const rl = await rateLimit({
      key: `lease-agreement:ip:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    if (!clientPromise) {
      return NextResponse.json(
        { ok: false, error: "Database not configured." },
        { status: 500 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid form data. Files may be too large (3MB max per file)." },
        { status: 400 }
      );
    }

    // Extract and validate text fields with length limits
    const operatorName = (formData.get("operatorName") as string)?.trim().slice(0, 200);
    const operatorMcNumber = (formData.get("operatorMcNumber") as string)?.trim().slice(0, 30);
    const operatorAddress = (formData.get("operatorAddress") as string)?.trim().slice(0, 500);
    const operatorDate = (formData.get("operatorDate") as string)?.trim().slice(0, 20);

    // Validate required fields
    if (!operatorName) {
      return NextResponse.json(
        { ok: false, error: "Owner-Operator Name is required." },
        { status: 400 }
      );
    }
    if (!operatorAddress) {
      return NextResponse.json(
        { ok: false, error: "Owner-Operator Address is required." },
        { status: 400 }
      );
    }
    if (!operatorDate) {
      return NextResponse.json(
        { ok: false, error: "Date is required." },
        { status: 400 }
      );
    }

    // Process file uploads
    const files: Record<
      string,
      { name: string; type: string; size: number; data: string }
    > = {};

    for (const field of REQUIRED_FILES) {
      const file = formData.get(field) as File | null;

      if (!file || file.size === 0) {
        return NextResponse.json(
          { ok: false, error: `${FILE_LABELS[field]} is required.` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            error: `${file.name} exceeds the 3MB file size limit. Please compress or resize the file.`,
          },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            ok: false,
            error: `${file.name} is not a supported file type. Please upload PDF, JPEG, or PNG files.`,
          },
          { status: 400 }
        );
      }

      const ext = getFileExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          {
            ok: false,
            error: `${file.name} has an unsupported file extension. Allowed: PDF, JPEG, PNG, WebP.`,
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      files[field] = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
      };
    }

    const client = await clientPromise;
    const db = client.db();

    const doc = {
      carrier: {
        name: "Twin Mile LLC",
        mcNumber: "MC1790263",
        address: "Houston Metropolitan Area",
        city: "Houston",
        state: "TX",
        zip: "77002",
      },
      operator: {
        name: operatorName,
        mcNumber: operatorMcNumber || "",
        address: operatorAddress,
        date: operatorDate,
      },
      documents: files,
      status: "pending_review",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("lease_agreements").insertOne(doc);
    console.log(
      "[lease-agreement] New submission:",
      result.insertedId,
      "from:",
      operatorName
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[lease-agreement] Submission error:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
