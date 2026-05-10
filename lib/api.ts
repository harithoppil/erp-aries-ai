"use client";

import useSWR, { mutate } from "swr";
import { throttledFetch } from "@/lib/throttledFetch";
import type {
  EnquiryRead,
  EnquiryCreate,
  EnquiryUpdate,
  WikiPageRead,
  WikiSearchResult,
  RAGSearchResult,
  RAGStats,
  PipelineRunResponse,
} from "@/types/api";

// ── API Bases ───────────────────────────────────────────────────────────────

/** Legacy Python backend (AI, RAG, pipeline — not yet ported to Frappe) */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

/** Frappe / ERPNext backend — use the proxy route for CORS safety */
export const FRAPPE_BASE = process.env.NEXT_PUBLIC_FRAPPE_URL || "/api/frappe";

/** Unwrap paginated ERP response {data: T[], total, limit, offset} → T[] */
export function unwrapPaginated<T>(raw: T[] | { data?: T[] }): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw) return (raw as { data?: T[] }).data ?? [];
  return raw as unknown as T[];
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await throttledFetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === "string"
      ? err.detail
      : Array.isArray(err.detail)
        ? err.detail.map((e: unknown) => {
            if (e && typeof e === "object" && "msg" in e && typeof (e as { msg: unknown }).msg === "string") {
              return (e as { msg: string }).msg;
            }
            return JSON.stringify(e);
          }).join("; ")
        : JSON.stringify(err.detail || err);
    throw new Error(msg || "API Error");
  }
  return res.json();
}

// ── SWR Hooks (Legacy — pages now use Server Actions) ───────────────────────

export function useEnquiries(status?: string) {
  const key = `/enquiries/${status ? `?status=${status}` : ""}`;
  return useSWR(key, () => fetchAPI<EnquiryRead[]>(key));
}

export function useEnquiry(id: string | null) {
  const key = id ? `/enquiries/${id}` : null;
  return useSWR(key, () => key ? fetchAPI<EnquiryRead>(key) : null);
}

export function useWikiPages() {
  return useSWR("/wiki/pages", () => fetchAPI<string[]>("/wiki/pages"));
}

export function useWikiPage(path: string | null) {
  const key = path ? `/wiki/pages/${path}` : null;
  return useSWR(key, () => key ? fetchAPI<WikiPageRead>(key) : null);
}

// ── Mutations (Legacy — use Server Actions instead) ─────────────────────────

export const createEnquiry = async (data: EnquiryCreate) => {
  const result = await fetchAPI<EnquiryRead>("/enquiries/", { method: "POST", body: JSON.stringify(data) });
  await mutate((key: string) => typeof key === "string" && key.startsWith("/enquiries"));
  return result;
};

export const updateEnquiry = async (id: string, data: Partial<EnquiryUpdate>) => {
  const result = await fetchAPI<EnquiryRead>(`/enquiries/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  await mutate(`/enquiries/${id}`);
  await mutate((key: string) => typeof key === "string" && key.startsWith("/enquiries"));
  return result;
};

export const approveEnquiry = async (id: string, approver: string) => {
  const result = await fetchAPI<EnquiryRead>(`/enquiries/${id}/approve?approver=${encodeURIComponent(approver)}`, { method: "POST" });
  await mutate(`/enquiries/${id}`);
  return result;
};

export const runPipeline = async (enquiryId: string) => {
  const result = await fetchAPI<PipelineRunResponse>("/pipeline/run", {
    method: "POST",
    body: JSON.stringify({ enquiry_id: enquiryId }),
  });
  await mutate(`/enquiries/${enquiryId}`);
  return result;
};

export const executeEnquiry = async (id: string) => {
  const result = await fetchAPI<Record<string, unknown>>(`/pipeline/execute/${id}`, { method: "POST" });
  await mutate(`/enquiries/${id}`);
  return result;
};

export const uploadDocument = async (enquiryId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/documents/${enquiryId}/upload`, { method: "POST", body: formData });
  return res.json();
};

export const listWikiPages = () => fetchAPI<string[]>("/wiki/pages");
export const getWikiPage = (path: string) => fetchAPI<WikiPageRead>(`/wiki/pages/${path}`);
export const createWikiPage = (path: string, content: string, msg = "Add page") =>
  fetchAPI<WikiPageRead>("/wiki/pages", { method: "POST", body: JSON.stringify({ path, content, commit_message: msg }) });
export const searchWiki = (q: string) => fetchAPI<WikiSearchResult[]>(`/wiki/search?q=${encodeURIComponent(q)}`);

// ── RAG API (Legacy backend) ────────────────────────────────────────────────

export const ragSearch = (query: string, method: string = "hybrid", limit: number = 10, modality?: string) =>
  fetchAPI<RAGSearchResult[]>(`/ai/rag/search?query=${encodeURIComponent(query)}&limit=${limit}&method=${method}${modality ? `&modality=${modality}` : ""}`, {
    method: "POST",
  });

export const ragIndexWiki = (route: string = "v2") =>
  fetchAPI<Record<string, unknown>>(`/ai/rag/index-wiki?route=${route}`, { method: "POST" });

export const ragIndexPage = (path: string, route: string = "v2") =>
  fetchAPI<{ path: string; chunks_indexed: number; route: string }>(`/ai/rag/index-page?path=${encodeURIComponent(path)}&route=${route}`, { method: "POST" });

export const getRagStats = () => fetchAPI<RAGStats>("/ai/rag/stats");

// ── Frappe ERPNext Direct Helpers (use from client components) ──────────────

/** Call any Frappe whitelisted method through the proxy */
export async function frappeMethod<T = unknown>(
  method: string,
  args?: Record<string, unknown>,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${FRAPPE_BASE}/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.exception || JSON.stringify(err));
  }
  const json = await res.json();
  return (json.message ?? json.data ?? json) as T;
}

/** Fetch a DocType list through the proxy */
export async function frappeResourceList<T = unknown>(
  doctype: string,
  fields?: string[],
  filters?: Record<string, unknown>,
  limit = 500
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set("fields", JSON.stringify(fields || ["*"]));
  if (filters) params.set("filters", JSON.stringify(filters));
  params.set("limit_page_length", String(limit));
  params.set("order_by", "creation desc");

  const res = await fetch(`${FRAPPE_BASE}/resource/${encodeURIComponent(doctype)}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch ${doctype}`);
  const json = await res.json();
  return (json.data ?? json) as T[];
}

/** Fetch a single document through the proxy */
export async function frappeResourceGet<T = unknown>(doctype: string, name: string): Promise<T> {
  const res = await fetch(`${FRAPPE_BASE}/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to fetch ${doctype}/${name}`);
  const json = await res.json();
  return (json.data ?? json) as T;
}

// ── Notebook API (Now uses Frappe Note DocType via Server Actions) ─────────

export interface NotebookRead {
  id: string;
  title: string;
  content: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

// Note: Use Server Actions from app/dashboard/notebooks/actions.ts instead
// These legacy helpers remain for backward compatibility:

export const listNotebooks = () => fetchAPI<NotebookRead[]>("/notebooks/");
export const getNotebook = (id: string) => fetchAPI<NotebookRead>(`/notebooks/${id}`);
export const createNotebook = (data: { title?: string; content?: string; metadata_json?: string }) =>
  fetchAPI<NotebookRead>("/notebooks/", { method: "POST", body: JSON.stringify(data) });
export const updateNotebook = (id: string, data: Partial<{ title: string; content: string; metadata_json: string }>) =>
  fetchAPI<NotebookRead>(`/notebooks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteNotebook = (id: string) => fetchAPI<void>(`/notebooks/${id}`, { method: "DELETE" });
