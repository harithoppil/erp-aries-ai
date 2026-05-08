"use client";

import { useEffect, useState, useRef } from "react";
import { listWikiPages, getWikiPage, searchWiki, createWikiPage, updateWikiPage, deleteWikiPage, type WikiPageRead, type WikiSearchResult } from "./actions";
import { ragSearch, type RAGSearchResult } from "@/app/actions/rag";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, FileText, BookOpen, X, Plus, Zap, Loader2, Image, Layers, Pencil, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SearchMode = "keyword" | "rag";

export default function WikiPage() {
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
  const [searchResults, setSearchResults] = useState<WikiSearchResult[]>([]);
  const [ragResults, setRagResults] = useState<RAGSearchResult[]>([]);
  const [ragMethod, setRagMethod] = useState<"hybrid" | "semantic" | "keyword">("hybrid");
  const [searching, setSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ path: "", content: "" });
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const pagesListRef = useRef<HTMLDivElement>(null);

  const loadPages = async () => {
    const result = await listWikiPages();
    if (result.success) setPages(result.pages);
  };

  useEffect(() => {
    loadPages();
  }, []);

  const handleSelectPage = async (path: string) => {
    setSelectedPage(path);
    const result = await getWikiPage(path);
    if (result.success) setContent(result.page.content);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      if (searchMode === "keyword") {
        const result = await searchWiki(searchQuery);
        if (result.success) setSearchResults(result.results);
        setRagResults([]);
      } else {
        const result = await ragSearch(searchQuery, ragMethod);
        if (result.success) setRagResults(result.results);
        setSearchResults([]);
      }
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createWikiPage(form.path, form.content, "Add page");
      if (result.success) {
        toast.success("Page created");
        setDialogOpen(false);
        setForm({ path: "", content: "" });
        loadPages();
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Network error");
    } finally { setSaving(false); }
  };

  const handleStartEdit = (path: string) => {
    setEditingPage(path);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingPage(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingPage) return;
    setEditSaving(true);
    try {
      const result = await updateWikiPage(editingPage, editContent, `Update ${editingPage}`);
      if (result.success) {
        toast.success("Page updated");
        setContent(editContent);
        setEditingPage(null);
        setEditContent("");
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update page");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      const result = await deleteWikiPage(path);
      if (result.success) {
        toast.success("Page deleted");
        if (selectedPage === path) {
          setSelectedPage(null);
          setContent("");
        }
        setDeleteConfirm(null);
        loadPages();
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to delete page");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <BookOpen className="h-4 w-4 text-[#1e3a5f]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">Company KnowledgeBase</h2>
                <p className="text-xs text-[#64748b]">{pages.length} pages</p>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> Add Page
            </Button>
          </div>

          {/* Search bar + mode toggle */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <Input
                  className="pl-10 bg-white border-gray-200"
                  placeholder={searchMode === "keyword" ? "Search knowledge base..." : "Semantic search — try natural language queries..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#152a45] transition-colors disabled:opacity-50"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </button>
            </div>

            {/* Search mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94a3b8]">Mode:</span>
              <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                <button
                  onClick={() => { setSearchMode("keyword"); setSearchResults([]); setRagResults([]); }}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    searchMode === "keyword"
                      ? "bg-white text-[#0f172a] shadow-sm"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <FileText size={10} />
                  Keyword
                </button>
                <button
                  onClick={() => { setSearchMode("rag"); setSearchResults([]); setRagResults([]); }}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    searchMode === "rag"
                      ? "bg-white text-[#0f172a] shadow-sm"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <Zap size={10} className="text-[#0ea5e9]" />
                  RAG
                </button>
              </div>

              {/* RAG method selector (only when RAG mode) */}
              {searchMode === "rag" && (
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-[10px] text-[#94a3b8]">Method:</span>
                  {(["hybrid", "semantic", "keyword"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setRagMethod(m)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        ragMethod === m
                          ? "bg-[#0ea5e9]/10 text-[#0ea5e9]"
                          : "text-[#94a3b8] hover:text-[#64748b]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Keyword search results */}
          {searchMode === "keyword" && searchResults.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#0f172a]">Search Results</h3>
                <button onClick={() => setSearchResults([])} className="text-[#94a3b8] hover:text-[#64748b]">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1">
                {searchResults.map((r) => (
                  <button
                    key={r.path}
                    onClick={() => { handleSelectPage(r.path); setSearchResults([]); }}
                    className="block w-full rounded-lg p-2 text-left text-sm hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-[#1e3a5f]">{r.title}</p>
                    <p className="text-xs text-[#94a3b8]">{r.snippet.slice(0, 120)}...</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RAG search results */}
          {searchMode === "rag" && ragResults.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#0f172a]">
                  <Zap size={12} className="text-[#0ea5e9]" />
                  Semantic Results
                </h3>
                <button onClick={() => setRagResults([])} className="text-[#94a3b8] hover:text-[#64748b]">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {ragResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (r.source_path) { handleSelectPage(r.source_path); setRagResults([]); }
                    }}
                    className={`block w-full rounded-lg p-3 text-left text-sm transition-colors ${
                      r.source_path ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-[#1e3a5f] truncate">
                        {r.heading || r.source_path || "Unknown"}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {r.modality && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            r.modality === "image"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-[#0ea5e9]/10 text-[#0ea5e9]"
                          }`}>
                            {r.modality === "image" ? <Image size={8} className="inline mr-0.5" /> : <Layers size={8} className="inline mr-0.5" />}
                            {r.modality}
                          </span>
                        )}
                        <span className="rounded-full bg-[#1e3a5f]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#1e3a5f]">
                          {r.score.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#94a3b8] line-clamp-2">{r.content}</p>
                    {r.source_path && (
                      <p className="mt-1 text-[10px] text-[#94a3b8]">{r.source_path}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            {/* Pages list */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
              <div className="border-b border-gray-100 px-4 py-3 shrink-0">
                <h3 className="text-sm font-semibold text-[#0f172a]">Pages</h3>
              </div>
              <div ref={pagesListRef} className="flex-1 overflow-y-auto p-2">
                {pages.length === 0 ? (
                  <div className="py-8 text-center text-[#94a3b8] text-sm">No pages yet</div>
                ) : (
                  <div className="space-y-0.5">
                    {pages.map((p) => (
                      <div key={p} className="group relative">
                        <button
                          onClick={() => handleSelectPage(p)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            selectedPage === p
                              ? "bg-[#1e3a5f]/10 text-[#1e3a5f] font-medium"
                              : "text-[#64748b] hover:bg-gray-50"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">{p}</span>
                        </button>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }}
                            className="p-1 rounded hover:bg-gray-200 text-[#64748b] hover:text-[#1e3a5f]"
                            title="Edit page"
                          >
                            <Pencil size={12} />
                          </button>
                          {deleteConfirm === p ? (
                            <div className="flex items-center gap-1 bg-red-50 rounded px-1 py-0.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                                className="text-[10px] font-medium text-red-600 hover:text-red-800"
                              >Yes</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                className="text-[10px] font-medium text-gray-500 hover:text-gray-700"
                              >No</button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p); }}
                              className="p-1 rounded hover:bg-red-50 text-[#64748b] hover:text-red-600"
                              title="Delete page"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-5">
                {selectedPage ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-[#0f172a]">{selectedPage}</h3>
                      {editingPage === selectedPage ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                          <Button size="sm" className="gap-1 bg-[#1e3a5f] hover:bg-[#152a45]" onClick={handleSaveEdit} disabled={editSaving}>
                            <Save size={14} /> {editSaving ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => handleStartEdit(selectedPage)}>
                          <Pencil size={14} /> Edit
                        </Button>
                      )}
                    </div>
                    {editingPage === selectedPage ? (
                      <textarea
                        className="w-full min-h-[400px] rounded-md border border-input bg-white px-3 py-2 text-sm font-mono"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                    ) : (
                      <div className="prose-wiki">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 className="text-xl font-bold text-[#0f172a] mt-6 mb-3">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold text-[#0f172a] mt-5 mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-semibold text-[#0f172a] mt-4 mb-2">{children}</h3>,
                            p: ({ children }) => <p className="text-sm text-[#334155] leading-relaxed mb-3">{children}</p>,
                            a: ({ href, children }) => <a href={href} className="text-[#1e3a5f] underline hover:no-underline">{children}</a>,
                            code: ({ className, children }) => {
                              const isBlock = className?.includes("language-");
                              if (isBlock) {
                                return <code className="block bg-gray-900 text-gray-100 rounded-lg p-4 text-sm font-mono overflow-x-auto my-3">{children}</code>;
                              }
                              return <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-[#0f172a]">{children}</code>;
                            },
                            pre: ({ children }) => <>{children}</>,
                            ul: ({ children }) => <ul className="ml-4 list-disc text-sm text-[#334155] mb-3">{children}</ul>,
                            ol: ({ children }) => <ol className="ml-4 list-decimal text-sm text-[#334155] mb-3">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-[#1e3a5f]/20 pl-4 italic text-[#64748b] my-3">{children}</blockquote>,
                            table: ({ children }) => <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden my-3">{children}</table>,
                            th: ({ children }) => <th className="bg-gray-50 px-3 py-2 text-left font-semibold text-[#0f172a] border-b border-gray-200">{children}</th>,
                            td: ({ children }) => <td className="px-3 py-2 border-b border-gray-100 text-[#334155]">{children}</td>,
                            hr: () => <hr className="my-4 border-gray-200" />,
                            strong: ({ children }) => <strong className="font-semibold text-[#0f172a]">{children}</strong>,
                            em: ({ children }) => <em>{children}</em>,
                          }}
                        >
                          {content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
                    <BookOpen size={48} className="mb-4 opacity-40" />
                    <p className="text-lg font-medium">Select a page</p>
                    <p className="text-sm">Choose a page from the sidebar to view its content</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Page Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Page</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Page Path</label>
              <Input required value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="e.g. guides/onboarding.md" />
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <textarea
                className="w-full min-h-[160px] rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="# Page Title\n\nWrite your markdown content here..."
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Page"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
