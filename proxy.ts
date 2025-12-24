import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "tm_session";
const ROLE_COOKIE = "tm_role";
const MUST_CHANGE_PASSWORD_COOKIE = "tm_mcpw";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdmin = pathname.startsWith("/admin");
  const isDriver = pathname.startsWith("/driver");

  if (!isAdmin && !isDriver) return NextResponse.next();

  const isLogin = pathname === "/admin/login" || pathname === "/driver/login";
  if (isLogin) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin/login" : "/driver/login", req.url)
    );
  }

  const role = req.cookies.get(ROLE_COOKIE)?.value;
  const mustChangePassword = req.cookies.get(MUST_CHANGE_PASSWORD_COOKIE)?.value;

  if (
    isDriver &&
    role === "driver" &&
    mustChangePassword === "1" &&
    !pathname.startsWith("/driver/settings/password")
  ) {
    return NextResponse.redirect(new URL("/driver/settings/password", req.url));
  }

  if (isAdmin && role === "driver") {
    return NextResponse.redirect(new URL("/driver", req.url));
  }
  if (isDriver && role === "admin") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*"],
};
