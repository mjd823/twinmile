import { NextRequest, NextResponse } from "next/server";

/**
 * Shared auth guard for Vercel cron routes.
 *
 * Accepts either:
 *   - `x-cron-secret: <CRON_SECRET>` header (manual/legacy invocation), or
 *   - `Authorization: Bearer <CRON_SECRET>` (Vercel automatically sends this
 *     header to cron invocations when a CRON_SECRET env var is set on the project).
 *
 * Returns a NextResponse to short-circuit with (500 if CRON_SECRET is not
 * configured, 401 if the caller failed auth), or null if the request is allowed.
 */
export function checkCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");

  if (headerSecret === secret || authHeader === `Bearer ${secret}`) {
    return null;
  }

  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
