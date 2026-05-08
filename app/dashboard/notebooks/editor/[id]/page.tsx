"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";

import { getNotebook, updateNotebook, type NotebookRead } from "@/app/dashboard/notebooks/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Loader2, Bot, Minus, Plus, RotateCcw,
} from "lucide-react";
import { EditorToolbar } from "@/app/dashboard/notebooks/editor/[id]/toolbar";

export default function NotebookEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [notebook, setNotebook] = useState<NotebookRead | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: true, inline: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontFamily,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[20cm]",
      },
    },
    content: "<p></p>",
  });

  useEffect(() => {
    if (!id) return;
    getNotebook(id).then((result) => {
      if (result.success) {
        setNotebook(result.notebook);
        setTitle(result.notebook.title);
        editor?.commands.setContent(result.notebook.content || "<p></p>");
      } else {
        toast.error(result.error);
      }
    }).catch(() => toast.error("Failed to load notebook"));
  }, [id, editor]);

  const handleSave = useCallback(async () => {
    if (!id || !editor) return;
    setSaving(true);
    try {
      const result = await updateNotebook(id, {
        title,
        content: editor.getHTML(),
      });
      if (result.success) {
        setNotebook(result.notebook);
        toast.success("Saved");
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [id, editor, title]);

  const handleAIAssist = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

    try {
      const res = await fetch(`${apiBase}/ai/chat/presales_assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `You are assisting with a document titled "${title}". The user says: ${aiPrompt}\n\nCurrent document content:\n${editor?.getHTML() || ""}`,
          context: "notebook_editor",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg = errData?.detail || res.statusText || "Unknown error";
        throw new Error(msg);
      }

      // Stream SSE response — read chunks and update UI progressively
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Handle SSE "data:" lines or plain text chunks
        const lines = chunk.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "[DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const token = parsed.content || parsed.text || parsed.delta || "";
              if (token) {
                accumulated += token;
                setAiResponse(accumulated);
              }
            } catch {
              // Not JSON — treat as raw text token
              accumulated += payload;
              setAiResponse(accumulated);
            }
          } else if (trimmed.startsWith("data:")) {
            const payload = trimmed.slice(5);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const token = parsed.content || parsed.text || parsed.delta || "";
              if (token) {
                accumulated += token;
                setAiResponse(accumulated);
              }
            } catch {
              accumulated += payload;
              setAiResponse(accumulated);
            }
          } else {
            // Plain text chunk (non-SSE fallback)
            try {
              const parsed = JSON.parse(trimmed);
              const token = parsed.content || parsed.text || parsed.delta || "";
              if (token) {
                accumulated += token;
                setAiResponse(accumulated);
              }
            } catch {
              accumulated += trimmed;
              setAiResponse(accumulated);
            }
          }
        }
      }

      // If streaming produced nothing, try parsing the full response as JSON (non-streaming fallback)
      if (!accumulated) {
        try {
          const fallback = JSON.parse(accumulated || "{}");
          const content = fallback.content || fallback.response || fallback.message || "No response received";
          setAiResponse(content);
        } catch {
          setAiResponse(accumulated || "No response received");
        }
      }
    } catch (e: any) {
      console.error("[notebook] AI assist failed:", e);
      toast.error(e.message || "AI request failed — check network connection");
    } finally {
      setAiLoading(false);
    }
  };

  const insertAIResponse = () => {
    if (aiResponse && editor) {
      editor.chain().focus().insertContent(`<p>${aiResponse}</p>`).run();
      setAiResponse("");
      setAiPrompt("");
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 10, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 50));
  const resetZoom = () => setZoom(100);

  if (!notebook) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0ea5e9]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f8fafc]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/notebooks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-lg font-medium border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 w-64"
              placeholder="Untitled document"
            />
            <span className="text-[10px] text-slate-400">
              {notebook ? `Edited ${new Date(notebook.updated_at).toLocaleDateString()}` : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(!aiOpen)} className="gap-1">
            <Bot size={14} /> AI Assist
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 bg-[#1e3a5f] hover:bg-[#152a45]">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor canvas */}
        <div className="flex-1 overflow-auto bg-[#f8fafc] relative">
          <div
            className="min-h-full flex justify-center py-8"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.2s ease",
            }}
          >
            <div
              className="bg-white shadow-xl"
              style={{
                width: "21cm",
                minHeight: "29.7cm",
              }}
            >
              <div style={{ padding: "2.54cm" }}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        {/* AI Sidebar */}
        {aiOpen && (
          <div className="w-80 border-l bg-white flex flex-col">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Bot size={16} className="text-[#0ea5e9]" /> AI Assistant
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Ask AI to write, summarize, rewrite..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7]"
                onClick={handleAIAssist}
                disabled={aiLoading}
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : "Generate"}
              </Button>
              {aiResponse && (
                <div className="space-y-2">
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {aiResponse}
                    {aiLoading && (
                      <span className="inline-block ml-0.5 w-1.5 h-4 bg-sky-500 animate-pulse align-text-bottom" />
                    )}
                  </div>
                  {!aiLoading && (
                    <Button size="sm" variant="outline" className="w-full" onClick={insertAIResponse}>
                      Insert into document
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Zoom bar */}
      <div className="flex items-center justify-end gap-2 border-t bg-white px-4 py-1.5 text-xs text-slate-500">
        <Button variant="ghost" size="icon" onClick={zoomOut} className="h-6 w-6">
          <Minus size={14} />
        </Button>
        <input
          type="range"
          min={50}
          max={200}
          step={10}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-24"
        />
        <Button variant="ghost" size="icon" onClick={zoomIn} className="h-6 w-6">
          <Plus size={14} />
        </Button>
        <Button variant="ghost" size="icon" onClick={resetZoom} className="h-6 w-6">
          <RotateCcw size={14} />
        </Button>
        <span className="min-w-[40px] text-right">{zoom}%</span>
      </div>
    </div>
  );
}
