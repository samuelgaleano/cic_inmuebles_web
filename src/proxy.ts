import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Protege las rutas del panel de administración.
 * (En Next.js 16 el antiguo `middleware` se llama `proxy`; runtime Node.)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login es público; el resto de /admin requiere sesión.
  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
