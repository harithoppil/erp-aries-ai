const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export { API_BASE };

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aries_token");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("aries_token");
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPost(path: string, body: unknown) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}

export async function apiPut(path: string, body: unknown) {
  return apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
}

export async function apiDelete(path: string) {
  return apiFetch(path, { method: "DELETE" });
}

export function unwrapPaginated(res: any): any[] {
  if (Array.isArray(res)) return res;
  return res.data || res.items || res.results || [];
}

/* ═══════════════════════════════════════════════════════════
 * v2.0 compat hooks & helpers
 * ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";

export function useEnquiries() {
  const [data, setData] = useState<any[] | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`${API_BASE}/enquiries`, {
      headers: { Authorization: `Bearer ${getToken() || ""}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem("aries_token");
          window.location.href = "/login";
          return [];
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(unwrapPaginated(json));
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, error, isLoading };
}

export async function createEnquiry(body: any) {
  return apiPost("/enquiries", body);
}

export async function listWikiPages(): Promise<string[]> {
  const res = await apiFetch("/wiki/pages");
  return Array.isArray(res) ? res : res.data || [];
}

export async function getWikiPage(path: string): Promise<{ content: string }> {
  return apiFetch(`/wiki/pages/${encodeURIComponent(path)}`);
}

export async function searchWiki(query: string): Promise<any[]> {
  const res = await apiFetch(`/wiki/search?q=${encodeURIComponent(query)}`);
  return Array.isArray(res) ? res : res.data || res.results || [];
}
