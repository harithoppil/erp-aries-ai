/**
 * UUID generation — Bun.randomUUIDv7() (time-sorted, Postgres-index-friendly).
 *
 * Why UUIDv7? UUIDv4 is fully random → severe B-tree index fragmentation
 * in PostgreSQL. UUIDv7 is monotonic (time-sorted) → sequential disk writes,
 * smaller indexes, faster range scans. Critical for high-volume ERP tables.
 */

/** Generate a UUIDv7 — monotonic, time-sorted, Postgres-friendly */
export function generateId(): string {
  return Bun.randomUUIDv7();
}

/**
 * Generate a short human-readable code from a UUIDv7.
 * e.g. "PO-1A2B3C4D" — first 8 hex chars uppercased
 */
export function generateShortCode(prefix: string): string {
  return `${prefix}-${generateId().slice(0, 8).toUpperCase()}`;
}
