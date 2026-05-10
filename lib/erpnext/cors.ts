/**
 * CORS Configuration — Helper for adding CORS headers to all API route responses.
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - All functions have explicit return types.
 * - Uses env vars for configuration, never hardcoded.
 */

import { NextResponse } from "next/server";

// ── CORS Header Constants ─────────────────────────────────────────────────────

const ALLOWED_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization";
const MAX_AGE = "86400";

/**
 * Get the allowed origin from environment, falling back to `*` in development.
 */
function getAllowedOrigin(): string {
  const envOrigin = process.env.CORS_ORIGIN;
  if (envOrigin) return envOrigin;

  // In development, allow all origins
  if (process.env.NODE_ENV === "development") return "*";

  // Production without explicit config — restrict to same-origin
  return "";
}

/**
 * Apply CORS headers to a NextResponse object.
 * Returns a new NextResponse with the CORS headers added.
 *
 * @param response - The existing NextResponse to add headers to
 * @returns New NextResponse with CORS headers applied
 */
export function withCors<T = unknown>(response: NextResponse<T>): NextResponse<T> {
  const origin = getAllowedOrigin();
  const headers = response.headers;

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  headers.set("Access-Control-Max-Age", MAX_AGE);

  return response;
}

/**
 * Create a standard CORS preflight (OPTIONS) response.
 *
 * @returns NextResponse with 204 and CORS headers
 */
export function corsPreflightResponse(): NextResponse {
  const origin = getAllowedOrigin();

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": MAX_AGE,
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}
