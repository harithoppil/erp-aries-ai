import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract a human-readable error message from an unknown thrown value.
 * Use in catch blocks instead of `catch (e) { e.message }` so the
 * caught value stays typed as `unknown`.
 */
export function errorMessage(err: unknown, fallback = "Unknown error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

/**
 * Read the `.code` property from an unknown thrown value (e.g. Prisma errors
 * carry codes like "P2025", "P2002"). Returns undefined if the value isn't an
 * object with a string `.code`.
 */
export function errorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

/**
 * Read a nested property from an unknown error's `.meta` (e.g. Prisma errors
 * attach `meta.field_name`, `meta.target`). Returns undefined if absent.
 */
export function errorMeta(err: unknown, key: string): unknown {
  if (err && typeof err === "object" && "meta" in err) {
    const meta = (err as { meta: unknown }).meta;
    if (meta && typeof meta === "object" && key in meta) {
      return (meta as Record<string, unknown>)[key];
    }
  }
  return undefined;
}

/** Read the constructor `.name` from an unknown thrown value, e.g. "TypeError". */
export function errorName(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  if (err && typeof err === "object" && "name" in err) {
    const n = (err as { name: unknown }).name;
    if (typeof n === "string") return n;
  }
  return undefined;
}
