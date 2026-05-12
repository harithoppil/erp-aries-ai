'use client';

// use-list-filters.ts — Tiny hook for filter state management with URL sync
// and debounced text-type changes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'not like' | 'in' | 'not in' | 'is set' | 'is not set';

export type FilterValue =
  | string
  | number
  | boolean
  | { from: string; to: string }
  | { operator: FilterOperator; value: unknown }
  | null;

interface UseListFiltersReturn {
  filters: Record<string, FilterValue>;
  setFilter: (fieldname: string, v: FilterValue) => void;
  clearAll: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Serialize a single filter value for URL query string. */
function serializeFilterValue(v: FilterValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object' && 'operator' in v) {
    const sf = v as { operator: string; value: unknown };
    return `${sf.operator}:${String(sf.value ?? '')}`;
  }
  if (typeof v === 'object' && 'from' in v) {
    const range = v as { from: string; to: string };
    return [range.from, range.to].join('~');
  }
  return String(v);
}

/** Deserialize a single filter value from URL query string. */
function deserializeFilterValue(raw: string): FilterValue {
  if (raw === '') return null;
  // Operator-structured values: "!=:Closed" or "like:search"
  const colonIdx = raw.indexOf(':');
  if (colonIdx > 0) {
    const opPart = raw.slice(0, colonIdx);
    const valPart = raw.slice(colonIdx + 1);
    if (opPart === 'is set' || opPart === 'is not set') {
      return { operator: opPart as FilterOperator, value: null };
    }
    return { operator: opPart as FilterOperator, value: valPart };
  }
  // Range values contain "~"
  if (raw.includes('~')) {
    const [from, to] = raw.split('~', 2);
    return { from: from ?? '', to: to ?? '' };
  }
  // Boolean values
  if (raw === '1') return true;
  if (raw === '0') return false;
  // Numeric values
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useListFilters(
  doctype: string,
  initial: Record<string, FilterValue> = {},
): UseListFiltersReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL if available, else from initial
  const [filters, setFilters] = useState<Record<string, FilterValue>>(() => {
    const fromUrl: Record<string, FilterValue> = {};
    const prefix = `f_`;
    for (const [key, val] of searchParams.entries()) {
      if (key.startsWith(prefix)) {
        const fieldname = key.slice(prefix.length);
        fromUrl[fieldname] = deserializeFilterValue(val);
      }
    }
    return Object.keys(fromUrl).length > 0 ? fromUrl : { ...initial };
  });

  // Debounce URL sync for text-type filter changes
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFiltersRef = useRef<Record<string, FilterValue>>(filters);

  // Sync to URL whenever filters change
  useEffect(() => {
    // Skip if filters haven't actually changed
    if (prevFiltersRef.current === filters) return;
    prevFiltersRef.current = filters;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams();

      // Preserve non-filter params
      for (const [key, val] of searchParams.entries()) {
        if (!key.startsWith('f_')) {
          params.set(key, val);
        }
      }

      // Add filter params
      for (const [fieldname, value] of Object.entries(filters)) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' && value === '') continue;
        if (
          typeof value === 'object' &&
          'from' in value &&
          (value as { from: string; to: string }).from === '' &&
          (value as { from: string; to: string }).to === ''
        )
          continue;

        const serialized = serializeFilterValue(value);
        if (serialized !== '') {
          params.set(`f_${fieldname}`, serialized);
        }
      }

      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '', { scroll: false });
    }, 250);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [filters, doctype, router, searchParams]);

  const setFilter = useCallback((fieldname: string, v: FilterValue) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (v === null || v === undefined || v === '') {
        delete next[fieldname];
      } else {
        next[fieldname] = v;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFilters({});
  }, []);

  return { filters, setFilter, clearAll };
}
