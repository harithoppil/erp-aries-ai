/**
 * Safe Transaction Wrapper — Wraps Prisma $transaction with structured error
 * handling, retry-safe Prisma error-code mapping, and consistent return types.
 *
 * Every multi-step DB operation in the ERPNext layer should use safeTransaction
 * instead of raw prisma.$transaction() so that callers receive a typed result
 * instead of an unhandled exception.
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - Every function has explicit params and return types.
 * - Maps Prisma error codes to user-friendly messages.
 * - Uses the same TxClient type pattern from PrismaClient omit.
 */

import { prisma } from "@/lib/prisma";
import { PrismaClient } from "@/prisma/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Prisma interactive-transaction client type.
 * Omits lifecycle / hook methods so the type matches what $transaction
 * callback receives.
 */
export type TxClient = Omit<
  PrismaClient,
  | "$connect"
  | "$disconnect"
  | "$on"
  | "$transaction"
  | "$use"
  | "$extends"
>;

/** Structured result from safeTransaction */
export interface TransactionResult<T> {
  /** Whether the transaction committed successfully */
  success: boolean;
  /** The return value of the transaction callback (when success=true) */
  data?: T;
  /** Human-readable error message (when success=false) */
  error?: string;
  /** Prisma error code (e.g. "P2002") or "UNKNOWN" */
  code?: string;
}

/** Options that can be passed to safeTransaction */
export interface SafeTransactionOptions {
  /** Maximum time (ms) to wait for a connection from the pool. Default 5000. */
  maxWait?: number;
  /** Maximum time (ms) the transaction may run. Default 10000. */
  timeout?: number;
}

/* ------------------------------------------------------------------ */
/*  Error code mapping                                                 */
/* ------------------------------------------------------------------ */

/**
 * Map a Prisma error code to a user-friendly message.
 * Falls back to the original message when the code is unknown.
 */
function mapPrismaError(code: string, originalMessage: string): string {
  switch (code) {
    case "P1001":
      return "Cannot reach database server";
    case "P1002":
      return "Database server reached but connection refused";
    case "P2002":
      return "Unique constraint violation — a record with this key already exists";
    case "P2003":
      return "Foreign key constraint violation — referenced record does not exist";
    case "P2012":
      return "Missing a required field that cannot be null";
    case "P2025":
      return "Record not found — operation targets a record that does not exist";
    case "P2034":
      return "Transaction failed due to a write conflict — please retry";
    default:
      return originalMessage;
  }
}

/* ------------------------------------------------------------------ */
/*  safeTransaction                                                    */
/* ------------------------------------------------------------------ */

/**
 * Execute a Prisma interactive transaction with structured error handling.
 *
 * Wraps `prisma.$transaction(fn, options)` and returns a `TransactionResult<T>`
 * instead of throwing. Callers can destructure:
 *
 * ```ts
 * const { success, data, error, code } = await safeTransaction(async (tx) => {
 *   // ... multi-step DB work ...
 *   return result;
 * });
 * ```
 *
 * @param fn      - Transaction callback receiving the tx client
 * @param options - Optional timeout / maxWait overrides
 * @returns Structured result with success flag, data, error, and code
 */
export async function safeTransaction<T>(
  fn: (tx: TxClient) => Promise<T>,
  options?: SafeTransactionOptions,
): Promise<TransactionResult<T>> {
  try {
    const result = await prisma.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    });
    return { success: true, data: result };
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    const code = error.code ?? "UNKNOWN";
    const originalMessage = error.message ?? "Transaction failed";
    const message = mapPrismaError(code, originalMessage);

    return { success: false, error: message, code };
  }
}
