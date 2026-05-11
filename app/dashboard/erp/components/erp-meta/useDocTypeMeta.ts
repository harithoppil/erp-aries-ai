'use client';

import { useEffect, useState } from 'react';
import type { DocTypeMeta } from '@/lib/erpnext/doctype-meta';

interface State {
  meta: DocTypeMeta | null;
  error: string | null;
  loading: boolean;
}

const inflight = new Map<string, Promise<DocTypeMeta>>();
const cache = new Map<string, DocTypeMeta>();

async function fetchMeta(doctype: string): Promise<DocTypeMeta> {
  const cached = cache.get(doctype);
  if (cached) return cached;
  const existing = inflight.get(doctype);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch(`/api/erpnext/meta/${encodeURIComponent(doctype)}`);
    if (!res.ok) throw new Error(`Failed to load meta for ${doctype}`);
    const json = (await res.json()) as { success: boolean; data?: DocTypeMeta; error?: string };
    if (!json.success || !json.data) throw new Error(json.error ?? 'Bad response');
    cache.set(doctype, json.data);
    return json.data;
  })();
  inflight.set(doctype, p);
  try {
    return await p;
  } finally {
    inflight.delete(doctype);
  }
}

/**
 * Fetch + cache DocType metadata client-side. `doctype` should be the kebab/
 * slug form ("sales-invoice"); the API resolves it to the display label.
 */
export function useDocTypeMeta(doctype: string): State {
  const [state, setState] = useState<State>({
    meta: cache.get(doctype) ?? null,
    error: null,
    loading: !cache.has(doctype),
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: !cache.has(doctype), error: null }));
    fetchMeta(doctype)
      .then((meta) => {
        if (!cancelled) setState({ meta, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            meta: null,
            error: err instanceof Error ? err.message : 'Failed to load metadata',
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doctype]);

  return state;
}
