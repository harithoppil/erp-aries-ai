"""API client for Aries Marine ERP backend."""
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
