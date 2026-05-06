"use client";

import { useEffect, useState, useRef } from "react";
import { listWikiPages, getWikiPage, searchWiki } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, FileText, BookOpen, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";

export default function WikiPage() {
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ path: string; title: string; snippet: string; score: number }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ path: "", content: "" });
  const pagesListRef = useRef<HTMLDivElement>(null);

  const loadPages = async () => {
    const p = await listWikiPages();
    setPages(p);
  };

  useEffect(() => {
    loadPages();
  }, []);

  const handleSelectPage = async (path: string) => {
    setSelectedPage(path);
    const page = await getWikiPage(path);
    setContent(page.content);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const results = await searchWiki(searchQuery);
    setSearchResults(results);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await throttledFetch(`${API_BASE}/wiki/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: form.path, content: form.content, commit_message: "Add page" }),
      });
      if (res.ok) {
        toast.success("Page created");
        setDialogOpen(false);
        setForm({ path: "", content: "" });
        loadPages();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create page");
      }
    } catch (e) {
      toast.error("Network error");
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Scrollable content */}
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

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <Input
                className="pl-10 bg-white border-gray-200"
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-medium hover:bg-[#152a45] transition-colors"
            >
              Search
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#0f172a]">Search Results</h3>
                <button
                  onClick={() => setSearchResults([])}
                  className="text-[#94a3b8] hover:text-[#64748b]"
                >
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
