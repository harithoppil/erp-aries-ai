// Shared ERPNext string utilities.
//
// `toKebabCase` is used by the sidebar, dashboard links, and ERPListClient
// to convert doctype display labels ("Sales Invoice") into URL slugs
// ("sales-invoice").
//
// `toDisplayLabel` lives in `prisma-delegate.ts` alongside `toAccessor` since
// those two are always used together when resolving Prisma delegates.

/**
 * Convert a PascalCase / camelCase / space-separated string to kebab-case.
 *
 *   "Sales Invoice" → "sales-invoice"
 *   "customerName"  → "customer-name"
 *   "BOM"           → "bom"
 */
export function toKebabCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}
