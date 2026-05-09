"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-responsive";
import { getEnquiry, runPipeline, approveEnquiry, executeEnquiry, listEnquiryDocuments, uploadDocument, type ClientSafeEnquiry, type ClientSafeDocument } from "@/app/dashboard/enquiries/actions";
import { STATUS_COLORS } from "@/types/api";
import { ArrowLeft, Play, CheckCircle, Upload, Zap, FileText, Loader2, Image } from "lucide-react";
import { toast } from "sonner";

interface ExecutionItem { system: string; success: boolean; message: string }

export default function EnquiryDetailPage() {
  const isMobile = useIsMobile();
  const { id } = useParams();
  const router = useRouter();
  const [enquiry, setEnquiry] = useState<ClientSafeEnquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<Record<string, unknown> | null>(null);
  const [executionResult, setExecutionResult] = useState<{ executions: ExecutionItem[] } | null>(null);
  const [acting, setActing] = useState(false);
  const [documents, setDocuments] = useState<ClientSafeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const loadEnquiry = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await getEnquiry(id as string);
      if (result.success) setEnquiry(result.enquiry);
      else setError(result.error);
    } catch (error:any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDocs = useCallback(async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const result = await listEnquiryDocuments(id as string);
      if (result.success) setDocuments(result.documents);
    } catch (error) { console.error("Failed to load documents:", error); }
    finally { setDocsLoading(false); }
  }, [id]);

  useEffect(() => {
    loadEnquiry();
    loadDocs();
  }, [loadEnquiry, loadDocs]);

  const reload = useCallback(async () => {
    await loadEnquiry();
    await loadDocs();
  }, [loadEnquiry, loadDocs]);

  const handleRunPipeline = async () => {
    setActing(true);
    try {
      const result = await runPipeline(id as string);
      if (result.success) {
        setPipelineResult(result.result);
        await reload();
      } else {
        toast.error(result.error);
      }
    } catch (error:any) { toast.error(error.message); } finally { setActing(false); }
  };

  const handleApprove = async () => {
    setActing(true);
    try {
      const result = await approveEnquiry(id as string, "Current User");
      if (result.success) await reload();
      else toast.error(result.error);
    } catch (error:any) { toast.error(error.message); } finally { setActing(false); }
  };

  const handleExecute = async () => {
    setActing(true);
    try {
      const result = await executeEnquiry(id as string);
      if (result.success) {
        setExecutionResult(result.result as { executions: ExecutionItem[] });
        await reload();
      } else {
        toast.error(result.error);
      }
    } catch (error:any) { toast.error(error.message); } finally { setActing(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadDocument(id as string, formData);
      if (result.success) {
        toast.success("Document uploaded and ingested!");
        await reload();
      } else {
        toast.error(result.error);
      }
    } catch (error:any) { toast.error("Upload failed: " + error.message); } finally { setActing(false); }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (error) return <div className="py-12 text-center text-red-500">{error}</div>;
  if (!enquiry) return <div className="py-12 text-center text-muted-foreground">Enquiry not found</div>;

  const canRunPipeline = ["draft", "ingested"].includes(enquiry.status);
  const canApprove = ["policy_review", "llm_drafted"].includes(enquiry.status);
  const canExecute = enquiry.status === "approved";

  const isImage = (ct: string) => ct.startsWith("image/");

  return (
    <div className={isMobile ? "" : "mx-auto max-w-4xl"}>
      <button onClick={() => router.back()} className="mb-4 flex h-10 w-10 items-center justify-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{enquiry.client_name}</h2>
          <p className="text-sm text-muted-foreground">{enquiry.enquiry_number || "No enquiry number"} · <span className={STATUS_COLORS[enquiry.status as keyof typeof STATUS_COLORS]}>{enquiry.status.replace(/_/g, " ")}</span></p>
        </div>
        <div className="flex gap-2">
          {canRunPipeline && <button onClick={handleRunPipeline} disabled={acting} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Play className="h-4 w-4" /> Run AI Pipeline</button>}
          {canApprove && <button onClick={handleApprove} disabled={acting} className="flex items-center gap-1 rounded-lg bg-sonar px-3 py-2 text-sm text-white hover:bg-sonar/90 disabled:opacity-50"><CheckCircle className="h-4 w-4" /> Approve</button>}
          {canExecute && <button onClick={handleExecute} disabled={acting} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Zap className="h-4 w-4" /> Execute</button>}
          <label className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-accent/50"><Upload className="h-4 w-4" /> Upload Doc<input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.xlsx,.pptx,.csv,.jpg,.jpeg,.png,.gif,.webp,.tiff,.bmp" /></label>
        </div>
      </div>

      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">Enquiry Details</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Industry</dt><dd>{enquiry.industry || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Channel</dt><dd>{enquiry.channel}</dd></div>
            <div><dt className="text-muted-foreground">Description</dt><dd className="whitespace-pre-wrap">{enquiry.description}</dd></div>
            {(enquiry.scope_category || enquiry.complexity) && (<>
              <div><dt className="text-muted-foreground">Category</dt><dd>{enquiry.scope_category}</dd></div>
              <div><dt className="text-muted-foreground">Complexity</dt><dd>{enquiry.complexity}</dd></div>
            </>)}
          </dl>
        </div>

        {/* Documents List */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">Documents</h3>
          {docsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  {isImage(doc.content_type) ? (
                    <Image className="h-4 w-4 shrink-0 text-amber" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.content_type} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    doc.processing_status === "completed" ? "bg-sonar/15 text-sonar" :
                    doc.processing_status === "failed" ? "bg-destructive/15 text-destructive" :
                    "bg-amber/15 text-amber"
                  }`}>{doc.processing_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {pipelineResult && (
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-semibold">AI Pipeline Output</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-primary">Status: {String(pipelineResult.status)?.replace(/_/g, " ")}</p>
                <p className="text-foreground">{String(pipelineResult.message)}</p>
              </div>
              {Boolean(pipelineResult.rules_output) && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium">Rules Output</p>
                  <pre className="mt-1 text-xs">{JSON.stringify(pipelineResult.rules_output, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {Boolean(pipelineResult?.llm_draft) && (
          <div className="col-span-2 rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-semibold">AI Draft Proposal</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{String(pipelineResult?.llm_draft ?? "")}</div>
          </div>
        )}

        {executionResult && (
          <div className="col-span-2 rounded-xl border bg-primary/10 p-5">
            <h3 className="mb-3 font-semibold text-primary">Execution Results</h3>
            <div className="space-y-2">
              {executionResult.executions?.map((r) => (
                <div key={r.system} className="flex items-center gap-2 text-sm">
                  <CheckCircle className={`h-4 w-4 ${r.success ? "text-sonar" : "text-destructive"}`} />
                  <span className="font-medium">{r.system}</span>
                  <span className="text-foreground">{r.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
