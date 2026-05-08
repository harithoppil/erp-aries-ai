/**
 * Bun.SQL native PostgreSQL driver — tagged template literals,
 * connection pooling, transactions, bulk inserts.
 *
 * Reads DATABASE_URL from .env automatically.
 *
 * Usage:
 *   import { sql, query, execute } from "@/lib/db-sql";
 *
 *   // Tagged template (auto-escapes, prevents SQL injection)
 *   const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
 *
 *   // Positional params ($1, $2, ...)
 *   const rows = await query<User>("SELECT * FROM users WHERE active = $1", [true]);
 *
 *   // DDL / DML with no return rows
 *   await execute("CREATE INDEX IF NOT EXISTS ...");
 */

import { sql as bunSql, type SQL } from "bun";

// ── Tagged template literal ──────────────────────────────────────────────

/** Type-safe SQL via tagged template. Auto-escapes interpolated values. */
export const sql = bunSql;

// ── Positional-param queries ─────────────────────────────────────────────

/**
 * Execute a raw SQL statement (DDL, DML) — no return rows.
 *
 * await execute("CREATE INDEX IF NOT EXISTS ...");
 * await execute("INSERT INTO logs (message) VALUES ($1)", ["hello"]);
 */
export async function execute(query: string, params?: any[]): Promise<void> {
  if (params && params.length) {
    await bunSql.unsafe(query, params);
  } else {
    await bunSql.unsafe(query);
  }
}

/**
 * Query for rows with typed results using positional params.
 *
 * const rows = await query<AccountBalance>(
 *   "SELECT account_id, SUM(debit) as debit FROM gl_entries WHERE posting_date >= $1 GROUP BY account_id",
 *   [fromDate]
 * );
 */
export async function query<T = any>(queryString: string, params?: any[]): Promise<T[]> {
  if (params && params.length) {
    return bunSql.unsafe(queryString, params) as Promise<T[]>;
  }
  return bunSql.unsafe(queryString) as Promise<T[]>;
}

/**
 * Query for a single row (first result or null).
 */
export async function queryOne<T = any>(queryString: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(queryString, params);
  return rows[0] ?? null;
}
