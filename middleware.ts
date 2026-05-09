import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ── Public routes that don't require authentication ─────────────────────────
const PUBLIC_ROUTES = ["/", "/auth", "/api/webhooks"];

// ── Role-based route protection ────────────────────────────────────────────
interface RouteRule {
  prefix: string;
  allowedRoles: string[];
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/dashboard/erp/accounts", allowedRoles: ["accounts_manager", "admin", "manager"] },
  { prefix: "/dashboard/erp/selling", allowedRoles: ["sales_manager", "admin", "manager"] },
  { prefix: "/dashboard/erp/buying", allowedRoles: ["purchase_manager", "admin", "manager"] },
  { prefix: "/dashboard/erp/stock", allowedRoles: ["stock_manager", "admin", "manager"] },
  { prefix: "/dashboard/erp/hr", allowedRoles: ["manager", "admin"] },
  { prefix: "/dashboard/admin", allowedRoles: ["admin"] },
];

// ── JWT verification helper ────────────────────────────────────────────────

interface JWTPayload {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  department?: string | null;
  subsidiary?: string | null;
  company?: string;
}

async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const JWT_SECRET_RAW = process.env.JWT_SECRET;
    if (!JWT_SECRET_RAW) return null;
    const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
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

  // Actually verify the JWT — not just check cookie existence
  const payload = await verifyJWT(token);

  if (!payload) {
    // Token is invalid or expired — redirect to login
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear the invalid token cookie
    response.cookies.delete("token");
    response.cookies.delete("refresh_token");
    return response;
  }

  // ── Role-based route protection ──────────────────────────────────────────
  const userRole = payload.role;

  if (userRole) {
    for (const rule of ROUTE_RULES) {
      if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
        if (!rule.allowedRoles.includes(userRole)) {
          // User doesn't have the required role — redirect to dashboard
          const dashboardUrl = new URL("/dashboard", request.url);
          dashboardUrl.searchParams.set("error", "access_denied");
          return NextResponse.redirect(dashboardUrl);
        }
        break; // Matched a rule — no need to check further
      }
    }
  }

  // Token is valid and role checks pass — let request through
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
