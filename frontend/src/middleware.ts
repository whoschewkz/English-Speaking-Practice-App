// frontend/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function dashboardFor(role: string | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "rater1" || role === "rater2") return "/rater";
  return "/practice";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth = request.cookies.get("is_authenticated")?.value === "true";
  const role   = request.cookies.get("user_role")?.value;
  const isRater = role === "rater1" || role === "rater2";

  // ── 1. Halaman /auth ────────────────────────────────────────────────────────
  // Jika sudah login → langsung ke dashboard sesuai role, tidak perlu lihat login lagi
  if (pathname === "/auth") {
    if (isAuth) {
      return NextResponse.redirect(new URL(dashboardFor(role), request.url));
    }
    return NextResponse.next();
  }

  // ── 2. Landing page "/" — publik, siapapun boleh lihat ─────────────────────
  // Link di dalamnya (/practice, /dashboard, dll) tetap terproteksi oleh cek di bawah
  if (pathname === "/") {
    return NextResponse.next();
  }

  // ── 3. Semua route lain wajib login ─────────────────────────────────────────
  if (!isAuth) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // ── 4. Role-based routing untuk user yang sudah login ──────────────────────

  // Admin dari /dashboard → /admin
  if ((pathname === "/dashboard" || pathname.startsWith("/dashboard/")) && role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Rater hanya boleh akses /rater
  if (isRater && (
    pathname === "/admin"    || pathname.startsWith("/admin/")    ||
    pathname === "/practice" || pathname.startsWith("/practice/") ||
    pathname === "/dashboard"|| pathname.startsWith("/dashboard/")
  )) {
    return NextResponse.redirect(new URL("/rater", request.url));
  }

  // User biasa tidak boleh akses /admin
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && role === "user") {
    return NextResponse.redirect(new URL("/practice", request.url));
  }

  // Non-rater tidak boleh akses /rater
  if ((pathname === "/rater" || pathname.startsWith("/rater/")) && !isRater && role !== "admin") {
    return NextResponse.redirect(new URL(dashboardFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Jalankan middleware di semua route kecuali file statis Next.js dan favicon
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};