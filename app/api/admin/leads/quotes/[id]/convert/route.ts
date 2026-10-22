import { NextResponse } from "next/server";
import { convertQuoteOnce, ConvertQuoteLeadSchema, QuoteConversionConflict } from "@/lib/quote-conversion";
import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!clientPromise) return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  const { id } = await ctx.params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  const parsed = ConvertQuoteLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.",
    issues: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  try {
    const client = await clientPromise;
    const result = await convertQuoteOnce(client.db(), id, parsed.data, String(admin._id));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof QuoteConversionConflict ? error.message : "Conversion outcome unavailable; retry the same reviewed terms." },
      { status: error instanceof QuoteConversionConflict ? 409 : 503 });
  }
}
