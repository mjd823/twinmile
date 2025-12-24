import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/csrf";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  await clearSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}
