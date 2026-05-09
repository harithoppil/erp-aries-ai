/**
 * Request Audit Logging — Structured request logging for all ERPNext API routes.
 *
 * Logs to console in structured JSON format and tracks request duration.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - All functions have explicit return types.
 * - Uses `unknown` for dynamic data, never `any`.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RequestLogEntry {
  timestamp: string;
  method: string;
  path: string;
  userId: string | null;
  doctype: string | null;
  docname: string | null;
  durationMs: number | null;
  status: number | null;
}

interface RequestStartContext {
  timestamp: string;
  method: string;
  path: string;
  userId: string | null;
  doctype: string | null;
  docname: string | null;
}

// ── Logger ────────────────────────────────────────────────────────────────────

/**
 * Log a completed request in structured format.
 * Writes a JSON line to stdout for log aggregation pipelines.
 */
export function logRequest(entry: RequestLogEntry): void {
  const line = JSON.stringify(entry);
  process.stdout.write(line + "\n");
}

/**
 * Begin tracking a request. Returns a context object that captures
 * the start time and request metadata.
 *
 * Call `logRequestEnd()` with the returned context and the final
 * status code to emit the log entry.
 *
 * @param method   - HTTP method (GET, POST, PUT, DELETE)
 * @param path     - Request URL path
 * @param userId   - Optional authenticated user ID
 * @param doctype  - Optional DocType being accessed
 * @param docname  - Optional document name being accessed
 * @returns Context object for `logRequestEnd()`
 */
export function logRequestStart(
  method: string,
  path: string,
  userId: string | null = null,
  doctype: string | null = null,
  docname: string | null = null,
): RequestStartContext {
  return {
    timestamp: new Date().toISOString(),
    method,
    path,
    userId,
    doctype,
    docname,
  };
}

/**
 * Complete request tracking and emit the log entry.
 *
 * @param start    - Context from `logRequestStart()`
 * @param status   - HTTP response status code
 */
export function logRequestEnd(
  start: RequestStartContext,
  status: number,
): void {
  const endTimestamp = new Date().toISOString();
  const durationMs = Date.now() - new Date(start.timestamp).getTime();

  const entry: RequestLogEntry = {
    timestamp: endTimestamp,
    method: start.method,
    path: start.path,
    userId: start.userId,
    doctype: start.doctype,
    docname: start.docname,
    durationMs,
    status,
  };

  logRequest(entry);
}
