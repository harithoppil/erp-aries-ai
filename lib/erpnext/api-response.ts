/**
 * Standardized API Response Format — Consistent response helpers for all
 * ERPNext API routes.
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - All functions have explicit return types.
 * - `unknown` for dynamic data, never `any`.
 */

// ── Interface ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown[];
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// ── Response Helpers ──────────────────────────────────────────────────────────

/**
 * Create a success response with optional pagination metadata.
 */
export function success<T>(data: T, meta?: ApiResponse["meta"]): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

/**
 * Create an error response with a machine-readable error code.
 */
export function error(
  message: string,
  code: string,
  details?: unknown[],
): ApiResponse {
  const response: ApiResponse = {
    success: false,
    error: message,
    code,
  };
  if (details && details.length > 0) {
    response.details = details;
  }
  return response;
}

/**
 * Create a validation error response (400).
 */
export function validationError(errors: unknown[]): ApiResponse {
  return {
    success: false,
    error: "Validation failed",
    code: "VALIDATION_ERROR",
    details: errors,
  };
}

/**
 * Create a not-found response (404).
 */
export function notFound(doctype: string, name: string): ApiResponse {
  return {
    success: false,
    error: `${doctype} "${name}" not found`,
    code: "NOT_FOUND",
  };
}

/**
 * Create an unauthorized response (401).
 */
export function unauthorized(message?: string): ApiResponse {
  return {
    success: false,
    error: message ?? "Authentication required",
    code: "UNAUTHORIZED",
  };
}

/**
 * Create a forbidden response (403) — RBAC denied.
 */
export function forbidden(action: string, doctype: string): ApiResponse {
  return {
    success: false,
    error: `Forbidden: cannot '${action}' on '${doctype}'`,
    code: "FORBIDDEN",
  };
}
