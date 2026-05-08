import { NextRequest, NextResponse } from "next/server";

// ── Public routes that don't require authentication ─────────────────────────
const PUBLIC_ROUTES = ["/auth", "/api/webhooks"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // static assets like .png, .ico, etc.
  ) {
    return NextResponse.next();
  }

  // Check for auth token cookie
  const token = request.cookies.get("token")?.value;

  if (!token) {
    // Redirect to login page
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — let request through.
  // Actual JWT verification happens in getSession() on the server side.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next (static files)
     * - api/webhooks (external callbacks)
     * - auth (login page itself)
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
