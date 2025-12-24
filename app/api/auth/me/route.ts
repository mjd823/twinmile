import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  const session = jar.get("tm_session")?.value;
  const role = jar.get("tm_role")?.value;

  const portalHref = role === "admin" ? "/admin" : role === "driver" ? "/driver" : null;

  return NextResponse.json(
    {
      loggedIn: Boolean(session && portalHref),
      role: role === "admin" || role === "driver" ? role : null,
      portalHref,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
