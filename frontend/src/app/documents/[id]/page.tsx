"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { listPersonas, chatWithPersona, type ClientSafePersona } from "@/app/ai/actions";
import {
  ArrowLeft, Bot, User, Send, FileText, Image as ImageIcon,
  CheckCircle, XCircle, Loader2, Eye, Sparkles,
  Download, ZoomIn, ZoomOut, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocRecord {
  id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  doc_type: string;
  auto_detected_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  processing_status: "pending" | "converting" | "processing" | "completed" | "failed";
  extracted_data: Record<string, any> | null;
  markdown_content: string | null;
  confidence_score: number | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  contract: "Contract",
  certificate: "Certificate",
  report: "Report",
  other: "Document",
};

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<DocRecord | null>(null);
  const imageUrl = docId ? `/api/document-image/${docId}` : null;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"data" | "chat">("data");
  const [zoom, setZoom] = useState(1);

  // AI chat state
  const [personas, setPersonas] = useState<ClientSafePersona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Load document
  useEffect(() => {
    if (!docId) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/document-upload/${docId}`);
        if (res.ok) setDoc(await res.json());
      } catch (e) {
        console.error(e);
        toast.error("Failed to load document");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [docId]);

  // Load personas
  useEffect(() => {
    const load = async () => {
      try {
        const result = await listPersonas({ enabled: true });
        if (result.success) {
          setPersonas(result.personas);
          if (result.personas.length > 0) setSelectedPersona(result.personas[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildDocumentContext = useCallback(() => {
    if (!doc) return "";
    let ctx = `You are analyzing a ${DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type} document titled "${doc.original_filename}".`;
    if (doc.extracted_data) {
      ctx += `\n\nExtracted structured data from the document:\n\`\`\`json\n${JSON.stringify(doc.extracted_data, null, 2)}\n\`\`\``;
    }
    ctx += `\n\nPlease answer the user's questions based on the document content and extracted data above. If you cannot answer from the provided information, say so clearly.`;
    return ctx;
  }, [doc]);

  const handleSend = async () => {
    if (!input.trim() || !selectedPersona || sending) return;

    const userText = input.trim();
    setInput("");
    setSending(true);

    const context = buildDocumentContext();
    const fullMessage = `${context}\n\nUser question: ${userText}`;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = `assist-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const chatResult = await chatWithPersona(selectedPersona, fullMessage);

      if (!chatResult.success) throw new Error(chatResult.error);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: chatResult.content, streaming: false, id: chatResult.message_id || assistantId }
            : m
        )
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${(e as Error).message}`, role: "system", streaming: false }
            : m
        )
      );
      toast.error("AI chat failed");
    } finally {
      setSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleQuickAsk = (question: string) => {
    setInput(question);
    setActiveTab("chat");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0ea5e9]" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-[calc(100vh-5.5rem)] flex-col items-center justify-center text-[#94a3b8]">
        <FileText size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">Document not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/documents")}>
          <ArrowLeft size={14} className="mr-2" /> Back to Documents
        </Button>
      </div>
    );
  }

  const isImage = doc.content_type.startsWith("image/");
  const isPdf = doc.content_type === "application/pdf";

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/documents")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a]">{doc.original_filename}</h2>
            <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
              <span>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</span>
              <span>·</span>
              <span>{formatFileSize(doc.file_size)}</span>
              <span>·</span>
              <span className={`capitalize ${
                doc.processing_status === "completed" ? "text-green-600" :
                doc.processing_status === "failed" ? "text-red-500" :
                doc.processing_status === "converting" ? "text-purple-500" :
                doc.processing_status === "processing" ? "text-[#0ea5e9]" :
                "text-amber-500"
              }`}>
                {doc.processing_status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" download={doc.original_filename}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download size={12} /> Download
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Document viewer */}
        <div className="flex-1 bg-[#f8fafc] flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-center gap-2 border-b border-gray-100 bg-white px-4 py-1.5 shrink-0">
            {isImage && (
              <>
                <button onClick={() => setZoom((z) => Math.min(z + 0.25, 2))} className="rounded p-1.5 hover:bg-gray-100 text-[#64748b]">
                  <ZoomIn size={14} />
                </button>
                <span className="text-[10px] text-[#64748b] w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} className="rounded p-1.5 hover:bg-gray-100 text-[#64748b]">
                  <ZoomOut size={14} />
                </button>
                <button onClick={() => setZoom(1)} className="rounded p-1.5 hover:bg-gray-100 text-[#64748b]">
                  <RotateCcw size={14} />
                </button>
              </>
            )}
          </div>

          {/* Document display */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {!imageUrl ? (
              <div className="text-[#94a3b8] text-sm">No preview available</div>
            ) : isImage ? (
              <img
                src={imageUrl}
                alt={doc.original_filename}
                className="max-w-full h-auto transition-transform duration-200 shadow-lg rounded-lg"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              />
            ) : isPdf ? (
              <iframe
                src={imageUrl}
                className="w-full h-full rounded-lg border border-gray-200 bg-white"
                title={doc.original_filename}
              />
            ) : doc.markdown_content ? (
              <div className="w-full max-w-3xl bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown_content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-[#94a3b8]">
                <FileText size={48} className="mb-4 opacity-40" />
                <p className="text-sm">Preview not available for this file type</p>
                <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-[#0ea5e9] hover:underline">
                  Open in new tab
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[380px] border-l border-gray-100 bg-white flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setActiveTab("data")}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === "data" ? "text-[#0ea5e9] border-b-2 border-[#0ea5e9]" : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              Extracted Data
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === "chat" ? "text-[#0ea5e9] border-b-2 border-[#0ea5e9]" : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              AI Assistant
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === "data" ? (
              <div className="p-4 space-y-4">
                {/* Quick AI questions */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase text-[#94a3b8]">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {["Summarize this document", "Extract key details", "Find discrepancies", "Explain totals"].map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuickAsk(q)}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] text-[#64748b] transition-colors hover:bg-[#0ea5e9] hover:text-white hover:border-[#0ea5e9]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {doc.processing_status === "completed" && doc.extracted_data ? (
                  <>
                    {/* Invoice-specific cards */}
                    {doc.doc_type === "invoice" && doc.extracted_data.seller && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[10px] font-medium uppercase text-[#94a3b8]">Seller</p>
                          <p className="text-sm font-semibold text-[#0f172a]">{doc.extracted_data.seller.name}</p>
                          {doc.extracted_data.seller.tax_id && (
                            <p className="text-[10px] text-[#64748b]">Tax: {doc.extracted_data.seller.tax_id}</p>
                          )}
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[10px] font-medium uppercase text-[#94a3b8]">Client</p>
                          <p className="text-sm font-semibold text-[#0f172a]">{doc.extracted_data.client?.name || "N/A"}</p>
                          {doc.extracted_data.client?.tax_id && (
                            <p className="text-[10px] text-[#64748b]">Tax: {doc.extracted_data.client.tax_id}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    {doc.extracted_data.summary && (
                      <div className="rounded-xl bg-[#0ea5e9]/5 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[#64748b]">
                            {doc.extracted_data.invoice_number || "Invoice"} · {doc.extracted_data.date_of_issue || "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-[#0ea5e9]">
                            {doc.extracted_data.summary.currency || "$"} {doc.extracted_data.summary.total?.toLocaleString() || "0"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Items table */}
                    {doc.extracted_data.items?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium uppercase text-[#94a3b8] mb-2">Line Items</p>
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-[#64748b]">Description</th>
                                <th className="text-right px-3 py-2 font-medium text-[#64748b]">Qty</th>
                                <th className="text-right px-3 py-2 font-medium text-[#64748b]">Price</th>
                                <th className="text-right px-3 py-2 font-medium text-[#64748b]">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {doc.extracted_data.items.map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-[#0f172a]">{item.description}</td>
                                  <td className="px-3 py-2 text-right text-[#64748b]">{item.quantity || "—"}</td>
                                  <td className="px-3 py-2 text-right text-[#64748b]">{item.unit_price || "—"}</td>
                                  <td className="px-3 py-2 text-right font-medium text-[#0f172a]">{item.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Raw JSON */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[#94a3b8] hover:text-[#0f172a]">Raw JSON</summary>
                      <pre className="mt-2 overflow-auto rounded-lg bg-[#0f172a] p-3 text-slate-200 text-[10px]">
                        {JSON.stringify(doc.extracted_data, null, 2)}
                      </pre>
                    </details>
                  </>
                ) : doc.processing_status === "converting" ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
                    <p className="text-sm">Converting document to text...</p>
                  </div>
                ) : doc.processing_status === "processing" ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0ea5e9] mb-3" />
                    <p className="text-sm">AI is processing this document...</p>
                  </div>
                ) : doc.processing_status === "failed" ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                    <XCircle className="h-8 w-8 text-red-500 mb-3" />
                    <p className="text-sm">Processing failed</p>
                    {doc.error_message && <p className="text-[10px] text-red-400 mt-1 max-w-[200px] text-center">{doc.error_message}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                    <Eye className="h-8 w-8 mb-3 opacity-40" />
                    <p className="text-sm">No extracted data yet</p>
                  </div>
                )}
              </div>
            ) : (
              /* AI Chat panel */
              <div className="flex flex-col h-full">
                {/* Persona selector */}
                <div className="border-b border-gray-100 px-3 py-2 shrink-0">
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-[#0f172a]"
                    value={selectedPersona || ""}
                    onChange={(e) => setSelectedPersona(e.target.value)}
                  >
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nickname} · {p.position}</option>
                    ))}
                  </select>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-[#94a3b8] px-4">
                      <Sparkles className="h-8 w-8 mb-3 opacity-40" />
                      <p className="text-sm font-medium">Ask AI about this document</p>
                      <p className="text-[10px] mt-1">The AI has access to the extracted data and can answer questions about content, totals, discrepancies, and more.</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role !== "user" && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ea5e9]/10">
                          <Bot size={12} className="text-[#0ea5e9]" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#1e3a5f] text-white rounded-br-sm"
                            : msg.role === "system"
                            ? "bg-red-50 text-red-700 rounded-bl-sm border border-red-100"
                            : "bg-gray-50 text-[#0f172a] rounded-bl-sm border border-gray-100"
                        }`}
                      >
                        {msg.role === "assistant" && !msg.streaming ? (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-[#0f172a] prose-pre:text-white prose-pre:p-2 prose-pre:rounded-md prose-pre:text-[10px] prose-code:text-[#0ea5e9] prose-code:before:content-[''] prose-code:after:content-['']">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                        {msg.streaming && (
                          <div className="mt-1.5 flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0ea5e9]" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0ea5e9]" style={{ animationDelay: "150ms" }} />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0ea5e9]" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f]/10">
                          <User size={12} className="text-[#1e3a5f]" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-gray-100 px-3 py-2 shrink-0">
                  <div className="flex gap-2">
                    <textarea
                      ref={chatInputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask about this document..."
                      rows={1}
                      className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#0ea5e9] focus:ring-1 focus:ring-[#0ea5e9]/20 min-h-[36px] max-h-[80px]"
                      disabled={sending}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="rounded-lg bg-[#0ea5e9] p-2 text-white transition-colors hover:bg-[#0284c7] disabled:opacity-40"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
