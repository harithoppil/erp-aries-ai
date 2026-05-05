"use client";

import { useState, useEffect, useRef } from "react";
import { API_BASE } from "@/lib/api";
import { Upload, FileText, CheckCircle, XCircle, Loader2, Eye, Image as ImageIcon, RefreshCw } from "lucide-react";

interface DocRecord {
  id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  doc_type: string;
  auto_detected_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  processing_status: "pending" | "processing" | "completed" | "failed";
  extracted_data: Record<string, any> | null;
  confidence_score: number | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: FileText, color: "text-amber", label: "Pending" },
  processing: { icon: Loader2, color: "text-[#0ea5e9]", label: "Processing" },
  completed: { icon: CheckCircle, color: "text-emerald-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  contract: "Contract",
  certificate: "Certificate",
  report: "Report",
  other: "Document",
};

export function DocumentUploadPanel({ entityType, entityId }: { entityType?: string; entityId?: string }) {
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, [entityType, entityId]);

  const loadDocuments = async () => {
    try {
      let url = `${API_BASE}/document-upload/?limit=50`;
      if (entityType) url += `&entity_type=${entityType}`;
      if (entityId) url += `&entity_id=${entityId}`;
      const res = await fetch(url);
      if (res.ok) setDocuments(await res.json());
    } catch (e) {
      console.error("Failed to load documents:", e);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        let url = `${API_BASE}/document-upload/upload?doc_type=invoice`;
        if (entityType) url += `&entity_type=${entityType}`;
        if (entityId) url += `&entity_id=${entityId}`;
        const res = await fetch(url, { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Upload failed:", err.detail || res.status);
        }
      } catch (e) {
        console.error("Upload error:", e);
      }
    }

    setUploading(false);
    loadDocuments();
  };

  const handleReprocess = async (docId: string) => {
    setReprocessing(docId);
    try {
      const res = await fetch(`${API_BASE}/document-upload/${docId}/process`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        if (selectedDoc?.id === updated.id) setSelectedDoc(updated);
      }
    } catch (e) {
      console.error("Reprocess failed:", e);
    }
    setReprocessing(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 transition-colors hover:border-[#0ea5e9] hover:bg-[#0ea5e9]/5 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-[#0ea5e9] dark:hover:bg-[#0ea5e9]/5"
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-[#0ea5e9]" />
        ) : (
          <Upload className="h-8 w-8 text-slate-400" />
        )}
        <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          {uploading ? "Uploading & processing..." : "Drop files here or click to upload"}
        </p>
        <p className="mt-1 text-xs text-slate-400">Invoice images, PDFs, receipts — AI will extract data automatically</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No documents uploaded yet. Upload an invoice or receipt to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const status = STATUS_CONFIG[doc.processing_status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors cursor-pointer hover:bg-accent/50 ${
                  selectedDoc?.id === doc.id ? "border-[#0ea5e9] bg-[#0ea5e9]/5" : "border-border"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                  {doc.content_type.startsWith("image/") ? (
                    <ImageIcon className="h-5 w-5 text-[#0ea5e9]" />
                  ) : (
                    <FileText className="h-5 w-5 text-amber" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.original_filename}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</span>
                    <span>·</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon
                    className={`h-4 w-4 ${status.color} ${doc.processing_status === "processing" ? "animate-spin" : ""}`}
                  />
                  <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extracted data viewer */}
      {selectedDoc && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#0ea5e9]" />
              <span className="text-sm font-semibold">{selectedDoc.original_filename}</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedDoc.processing_status === "failed" && (
                <button
                  onClick={() => handleReprocess(selectedDoc.id)}
                  disabled={reprocessing === selectedDoc.id}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0ea5e9] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0284c7] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${reprocessing === selectedDoc.id ? "animate-spin" : ""}`} />
                  Retry
                </button>
              )}
              <button
                onClick={() => setSelectedDoc(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {selectedDoc.processing_status === "completed" && selectedDoc.extracted_data ? (
              <div className="space-y-3">
                {/* Invoice-specific display */}
                {selectedDoc.doc_type === "invoice" && selectedDoc.extracted_data.seller && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="text-[10px] font-medium uppercase text-slate-400">Seller</p>
                      <p className="text-sm font-semibold">{selectedDoc.extracted_data.seller.name}</p>
                      {selectedDoc.extracted_data.seller.tax_id && (
                        <p className="text-xs text-muted-foreground">Tax: {selectedDoc.extracted_data.seller.tax_id}</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="text-[10px] font-medium uppercase text-slate-400">Client</p>
                      <p className="text-sm font-semibold">{selectedDoc.extracted_data.client?.name || "N/A"}</p>
                      {selectedDoc.extracted_data.client?.tax_id && (
                        <p className="text-xs text-muted-foreground">Tax: {selectedDoc.extracted_data.client.tax_id}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedDoc.extracted_data.summary && (
                  <div className="flex items-center justify-between rounded-lg bg-[#0ea5e9]/5 px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Invoice #{selectedDoc.extracted_data.invoice_number || "N/A"}</p>
                      <p className="text-[10px] text-muted-foreground">Date: {selectedDoc.extracted_data.date_of_issue || "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#0ea5e9]">
                        {selectedDoc.extracted_data.summary.currency || "$"} {selectedDoc.extracted_data.summary.total?.toLocaleString() || "0"}
                      </p>
                      {selectedDoc.extracted_data.summary.subtotal != null && (
                        <p className="text-[10px] text-muted-foreground">
                          Subtotal: {selectedDoc.extracted_data.summary.subtotal} | Tax: {selectedDoc.extracted_data.summary.tax_amount || 0}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Items table */}
                {selectedDoc.extracted_data.items?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5">Description</th>
                          <th className="px-2 py-1.5 text-right">Qty</th>
                          <th className="px-2 py-1.5 text-right">Unit Price</th>
                          <th className="px-2 py-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedDoc.extracted_data.items.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-accent/30">
                            <td className="px-2 py-1.5">{item.description}</td>
                            <td className="px-2 py-1.5 text-right">{item.quantity || "—"}</td>
                            <td className="px-2 py-1.5 text-right">{item.unit_price || "—"}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Raw JSON toggle */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw JSON</summary>
                  <pre className="mt-2 overflow-auto rounded-lg bg-slate-900 p-3 text-slate-200">
                    {JSON.stringify(selectedDoc.extracted_data, null, 2)}
                  </pre>
                </details>
              </div>
            ) : selectedDoc.processing_status === "failed" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Processing Failed</p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{selectedDoc.error_message || "Unknown error"}</p>
              </div>
            ) : selectedDoc.processing_status === "processing" ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#0ea5e9]" />
                <span className="text-sm text-muted-foreground">Processing with Vertex AI...</span>
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Document uploaded, waiting to be processed.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
