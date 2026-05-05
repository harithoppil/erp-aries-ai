"use client";

import { FileText } from "lucide-react";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { usePageContext } from "@/hooks/usePageContext";

export default function DocumentsPage() {
  usePageContext("Documents — Upload invoices, receipts, and documents for AI extraction");

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0ea5e9]/10">
          <FileText className="h-5 w-5 text-[#0ea5e9]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Documents</h2>
          <p className="text-[11px] text-muted-foreground">Upload invoices & receipts — AI extracts structured data via Vertex AI</p>
        </div>
      </div>

      <DocumentUploadPanel />
    </div>
  );
}
