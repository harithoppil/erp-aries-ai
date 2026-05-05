/* Simple throttled fetch wrapper — v2.0 compat */
const THROTTLE_MS = 300;
let lastFetch = 0;

export async function throttledFetch(url: string, options?: RequestInit) {
  const now = Date.now();
  const wait = Math.max(0, lastFetch + THROTTLE_MS - now);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastFetch = Date.now();
  const token = typeof window !== "undefined" ? localStorage.getItem("aries_token") : null;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("aries_token");
    window.location.href = "/login";
  }
  return res;
}
