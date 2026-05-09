/**
 * Database Connection Retry — Wraps the Prisma singleton with retry logic
 * for transient connection errors, and provides a health-check function.
 *
 * Handles Prisma error codes:
 *   P1001 — Can't reach database server
 *   P1002 — Server reached but connection refused
 *   P1008 — Operations timed out
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - Exponential backoff: 1s, 2s, 4s (3 retries max).
 */

import { prisma } from "@/lib/prisma";
import { PrismaClient } from "@/prisma/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Result of a retried operation */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retries: number;
}

/** Health check result */
export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Configuration for retry behavior */
export interface RetryConfig {
  /** Maximum number of retries. Default 3. */
  maxRetries: number;
  /** Base delay in ms for exponential backoff. Default 1000. */
  baseDelayMs: number;
  /** Prisma error codes that should trigger a retry. */
  retryableCodes: string[];
}

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableCodes: ["P1001", "P1002", "P1008"],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if a Prisma error code is retryable.
 */
function isRetryableError(e: unknown, codes: string[]): boolean {
  const error = e as { code?: string };
  return typeof error.code === "string" && codes.includes(error.code);
}

/* ------------------------------------------------------------------ */
/*  withRetry                                                          */
/* ------------------------------------------------------------------ */

/**
 * Execute an async function with automatic retry on transient connection errors.
 *
 * Uses exponential backoff: baseDelay * 2^attempt (1s, 2s, 4s for default config).
 *
 * @param fn       - The async function to execute
 * @param config   - Optional override for retry configuration
 * @returns Result with success flag, data, and retry count
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<RetryResult<T>> {
  const cfg: RetryConfig = {
    maxRetries: config?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
    baseDelayMs: config?.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
    retryableCodes: config?.retryableCodes ?? DEFAULT_RETRY_CONFIG.retryableCodes,
  };

  let lastError: string = "";
  let retries = 0;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, data: result, retries };
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);

      if (!isRetryableError(e, cfg.retryableCodes)) {
        // Non-retryable error — return immediately
        return { success: false, error: lastError, retries };
      }

      if (attempt < cfg.maxRetries) {
        // Exponential backoff before next retry
        const delay = cfg.baseDelayMs * Math.pow(2, attempt);
        retries += 1;
        console.warn(
          `[connection-retry] Retryable error (attempt ${attempt + 1}/${cfg.maxRetries}): ` +
          `${lastError}. Retrying in ${delay}ms...`,
        );
        await sleep(delay);
      }
    }
  }

  return { success: false, error: lastError, retries };
}

/* ------------------------------------------------------------------ */
/*  checkDatabaseHealth                                                */
/* ------------------------------------------------------------------ */

/**
 * Check if the database connection is healthy by running a simple query.
 *
 * Uses `prisma.$queryRaw` with a lightweight `SELECT 1` to verify
 * that the connection pool can serve a query. Measures latency.
 *
 * @returns Health check result with latency and error info
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
    const latencyMs = Date.now() - start;

    return { healthy: true, latencyMs };
  } catch (e: unknown) {
    const latencyMs = Date.now() - start;
    const message = e instanceof Error ? e.message : String(e);

    return { healthy: false, latencyMs, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  retriedPrisma — Convenience wrapper                                */
/* ------------------------------------------------------------------ */

/**
 * A convenience object that wraps common Prisma operations with retry logic.
 * Use this when you need simple CRUD with automatic retry on connection errors.
 *
 * For complex multi-step operations, use `safeTransaction` with `withRetry`
 * combined at the route level.
 */
export const retriedPrisma = {
  /**
   * Execute a read operation with retry logic.
   *
   * @param fn - Function that performs a Prisma read using the global prisma instance
   * @returns Retry result wrapping the read data
   */
  async read<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    return withRetry(fn, { retryableCodes: ["P1001", "P1002", "P1008"] });
  },

  /**
   * Execute a write operation with retry logic.
   *
   * Note: For multi-step writes, prefer `safeTransaction` from
   * transaction-wrapper.ts instead of this method.
   *
   * @param fn - Function that performs a Prisma write using the global prisma instance
   * @returns Retry result wrapping the write result
   */
  async write<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    return withRetry(fn, { retryableCodes: ["P1001", "P1002", "P1008", "P2034"] });
  },
};
