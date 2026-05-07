"use client";

import { useEffect, useState, useRef } from "react";
import { listWikiPages, getWikiPage, searchWiki, createWikiPage, type WikiPageRead, type WikiSearchResult } from "./actions";
import { ragSearch, type RAGSearchResult } from "@/app/actions/rag";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, FileText, BookOpen, X, Plus, Zap, Loader2, Image, Layers } from "lucide-react";
import { toast } from "sonner";

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
                      <button
                        key={p}
                        onClick={() => handleSelectPage(p)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selectedPage === p
                            ? "bg-[#1e3a5f]/10 text-[#1e3a5f] font-medium"
                            : "text-[#64748b] hover:bg-gray-50"
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p}</span>
                      </button>
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
                    <h3 className="text-lg font-semibold text-[#0f172a] mb-3">{selectedPage}</h3>
                    <pre className="whitespace-pre-wrap text-sm text-[#334155] leading-relaxed">{content}</pre>
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
