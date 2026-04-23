// frontend/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth  = request.cookies.get("is_authenticated")?.value === "true";
  const role    = request.cookies.get("user_role")?.value;

  // Belum login → ke /auth
  const protectedRoutes = ["/practice", "/dashboard", "/admin"];
  const needsAuth = protectedRoutes.some(r => pathname.startsWith(r));
  if (needsAuth && !isAuth) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Admin coba akses /dashboard → redirect ke /admin
  if (pathname.startsWith("/dashboard") && role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // User coba akses /admin → redirect ke /practice
  if (pathname.startsWith("/admin") && role === "user") {
    return NextResponse.redirect(new URL("/practice", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/practice/:path*", "/dashboard/:path*", "/admin/:path*"],
};