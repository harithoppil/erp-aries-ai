/**
 * Server-side API base URL — safe to import from Server Actions and server components.
 *
 * The main api.ts file has "use client" (for SWR hooks), so Server Actions that
 * need to proxy to the Python backend should import from this file instead.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";
