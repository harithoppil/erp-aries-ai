"use client";

import useSWR, { mutate } from "swr";
import { throttledFetch } from "./throttledFetch";
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

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

/** Paginated response from ERP endpoints */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Unwrap paginated ERP response {data: T[], total, limit, offset} → T[] */
export function unwrapPaginated<T>(raw: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in raw) return (raw as PaginatedResponse<T>).data;
  return raw as unknown as T[];
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await throttledFetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // Handle Pydantic validation errors (array of objects) vs simple string errors
    const msg = typeof err.detail === "string"
      ? err.detail
      : Array.isArray(err.detail)
        ? err.detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ")
        : JSON.stringify(err.detail || err);
    throw new Error(msg || "API Error");
  }
  return res.json();
}

// --- SWR Hooks ---

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

// --- Mutations ---

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

// --- RAG API ---
export const ragSearch = (query: string, method: string = "hybrid", limit: number = 10, modality?: string) =>
  fetchAPI<RAGSearchResult[]>(`/ai/rag/search?query=${encodeURIComponent(query)}&limit=${limit}&method=${method}${modality ? `&modality=${modality}` : ""}`, {
    method: "POST",
  });
export const ragIndexWiki = (route: string = "v2") =>
  fetchAPI<Record<string, unknown>>(`/ai/rag/index-wiki?route=${route}`, { method: "POST" });
export const ragIndexPage = (path: string, route: string = "v2") =>
  fetchAPI<{ path: string; chunks_indexed: number; route: string }>(`/ai/rag/index-page?path=${encodeURIComponent(path)}&route=${route}`, { method: "POST" });
export const getRagStats = () => fetchAPI<RAGStats>("/ai/rag/stats");

// --- ERP SWR Hooks ---
// Note: Pages now use Server Actions (actions.ts) instead of these hooks.
// These are kept for backward compatibility but typed properly.

interface ERPAccount { id: string; name: string; account_type: string | null; balance: number; currency: string }
interface ERPAsset { id: string; asset_name: string; asset_code: string; asset_category: string; status: string }
interface ERPItem { id: string; item_name: string; item_code: string; item_group: string; unit: string }
interface ERPWarehouse { id: string; warehouse_name: string; warehouse_code: string }
interface ERPBin { id: string; item_id: string; warehouse_id: string; quantity: number }
interface ERPProject { id: string; project_name: string; project_code: string; status: string; customer_name: string }
interface ERPPersonnel { id: string; first_name: string; last_name: string; email: string | null; designation: string | null; status: string }
interface ERPSupplier { id: string; supplier_name: string; supplier_code: string; email: string | null; category: string | null }
interface ERPPurchaseOrder { id: string; po_number: string; supplier_name: string; status: string; total: number }
interface ERPMaterialRequest { id: string; request_number: string; status: string; purpose: string | null }
interface ERPStockEntry { id: string; entry_type: string; item_id: string; quantity: number }

export function useERPData<T>(endpoint: string) {
  return useSWR(endpoint, async () => {
    const res = await fetchAPI<PaginatedResponse<T>>(endpoint);
    return res.data;
  });
}

export const useAccounts = () => useERPData<ERPAccount>("/erp/accounts");
export const useAssets = () => useERPData<ERPAsset>("/erp/assets");
export const useItems = () => useERPData<ERPItem>("/erp/items");
export const useWarehouses = () => useERPData<ERPWarehouse>("/erp/warehouses");
export const useBins = () => useERPData<ERPBin>("/erp/bins");
export const useProjects = () => useERPData<ERPProject>("/erp/projects");
export const usePersonnel = () => useERPData<ERPPersonnel>("/erp/personnel");
export const useSuppliers = () => useERPData<ERPSupplier>("/erp/suppliers");
export const usePurchaseOrders = () => useERPData<ERPPurchaseOrder>("/erp/purchase-orders");
export const useMaterialRequests = () => useERPData<ERPMaterialRequest>("/erp/material-requests");
export const useStockEntries = () => useERPData<ERPStockEntry>("/erp/stock-entries");

// --- Notebook API ---
export interface NotebookRead {
  id: string;
  title: string;
  content: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export const listNotebooks = () => fetchAPI<NotebookRead[]>("/notebooks/");
export const getNotebook = (id: string) => fetchAPI<NotebookRead>(`/notebooks/${id}`);
export const createNotebook = (data: { title?: string; content?: string; metadata_json?: string }) =>
  fetchAPI<NotebookRead>("/notebooks/", { method: "POST", body: JSON.stringify(data) });
export const updateNotebook = (id: string, data: Partial<{ title: string; content: string; metadata_json: string }>) =>
  fetchAPI<NotebookRead>(`/notebooks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteNotebook = (id: string) => fetchAPI<void>(`/notebooks/${id}`, { method: "DELETE" });
