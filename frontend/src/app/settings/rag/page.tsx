"use client";

import { useState, useEffect, useCallback } from "react";
import { getRagStats, ragSearch, indexWikiAll, indexWikiPage, type RAGStatsResponse } from "@/app/actions/rag";
import type { RAGSearchResult, RAGStats } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database, RefreshCw, Search, Upload, FileText,
  Zap, Layers, Image, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "overview" | "index" | "search";

export default function RAGSettingsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Index state
  const [indexingAll, setIndexingAll] = useState(false);
  const [indexPagePath, setIndexPagePath] = useState("");
  const [indexingPage, setIndexingPage] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMethod, setSearchMethod] = useState<"hybrid" | "semantic" | "keyword">("hybrid");
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const result = await getRagStats();
      if (result.success) setStats(result.stats);
      else setStats(null);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleIndexAll = async () => {
    setIndexingAll(true);
    try {
      const result = await indexWikiAll("v2");
      if (result.success) {
        toast.success(`Indexed wiki pages`);
        loadStats();
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Indexing failed");
    } finally {
      setIndexingAll(false);
    }
  };

  const handleIndexPage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!indexPagePath.trim()) return;
    setIndexingPage(true);
    try {
      const result = await indexWikiPage(indexPagePath.trim());
      if (result.success) {
        toast.success(`Indexed page: ${indexPagePath.trim()}`);
        setIndexPagePath("");
        loadStats();
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Indexing failed");
    } finally {
      setIndexingPage(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await ragSearch(searchQuery, searchMethod);
      if (result.success) setSearchResults(result.results);
      else toast.error(result.error);
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Database },
    { key: "index", label: "Index", icon: Upload },
    { key: "search", label: "Search", icon: Search },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
          <Database className="h-5 w-5 text-[#1e3a5f]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">RAG Vector Store</h2>
          <p className="text-xs text-[#64748b]">Gemini embedding-2 + pgvector — semantic & hybrid search</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-[#0f172a] shadow-sm"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0f172a]">Store Statistics</h3>
            <button onClick={loadStats} className="text-[#64748b] hover:text-[#0f172a] transition-colors">
              <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} />
            </button>
          </div>

          {loadingStats && !stats ? (
            <div className="flex items-center justify-center py-12 text-[#94a3b8]">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading stats...
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(stats).map(([route, data]: [string, { total_chunks: number; modalities: Record<string, number> }]) => (
                <div key={route} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap size={14} className={route === "v2" ? "text-[#0ea5e9]" : "text-[#64748b]"} />
                    <span className="text-sm font-semibold text-[#0f172a]">
                      Route: {route}
                    </span>
                    {route === "v2" && (
                      <span className="rounded-full bg-[#0ea5e9]/10 px-2 py-0.5 text-[10px] font-medium text-[#0ea5e9]">
                        MULTIMODAL
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Total Chunks</span>
                      <span className="font-medium text-[#0f172a]">{data.total_chunks ?? 0}</span>
                    </div>
                    {data.modalities && Object.entries(data.modalities).map(([mod, count]) => (
                      <div key={mod} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#64748b]">
                          {mod === "image" ? <Image size={12} /> : <Layers size={12} />}
                          {mod}
                        </span>
                        <span className="font-medium text-[#0f172a]">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
              <AlertCircle size={32} className="mx-auto mb-3 text-[#94a3b8]" />
              <p className="text-sm text-[#64748b]">Could not load RAG stats. Ensure the backend and PostgreSQL are running.</p>
            </div>
          )}

          {/* Quick info */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-[#0f172a]">How It Works</h3>
            <div className="space-y-2 text-xs text-[#64748b] leading-relaxed">
              <p><strong className="text-[#0f172a]">v2 (default):</strong> gemini-embedding-2 — 768-dim multimodal vectors. Supports text + image in the same vector space.</p>
              <p><strong className="text-[#0f172a]">v1:</strong> gemini-embedding-001 — text-only embeddings. Use for backwards compatibility.</p>
              <p><strong className="text-[#0f172a]">Search methods:</strong> <code>semantic</code> (cosine similarity), <code>keyword</code> (BM25 full-text), <code>hybrid</code> (both combined).</p>
              <p><strong className="text-[#0f172a]">Wiki search vs RAG:</strong> Wiki search (<code>/wiki/search</code>) is plain keyword matching. RAG search (<code>/ai/rag/search</code>) uses vector embeddings for semantic understanding.</p>
            </div>
          </div>
        </div>
      )}

      {/* Index Tab */}
      {tab === "index" && (
        <div className="space-y-5">
          {/* Index all wiki */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Upload size={16} className="text-[#1e3a5f]" />
              <h3 className="text-sm font-semibold text-[#0f172a]">Index All Wiki Pages</h3>
            </div>
            <p className="mb-4 text-xs text-[#64748b]">
              Chunk all wiki pages, generate gemini-embedding-2 vectors, and store in pgvector. Run this after adding new pages or when the index is stale.
            </p>
            <Button
              onClick={handleIndexAll}
              disabled={indexingAll}
              className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"
            >
              {indexingAll ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {indexingAll ? "Indexing..." : "Index All Wiki (v2)"}
            </Button>
          </div>

          {/* Index single page */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText size={16} className="text-[#1e3a5f]" />
              <h3 className="text-sm font-semibold text-[#0f172a]">Index Single Page</h3>
            </div>
            <p className="mb-4 text-xs text-[#64748b]">
              Re-index a specific wiki page after editing it. Faster than re-indexing everything.
            </p>
            <form onSubmit={handleIndexPage} className="flex gap-2">
              <Input
                value={indexPagePath}
                onChange={(e) => setIndexPagePath(e.target.value)}
                placeholder="e.g. guides/onboarding.md"
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={indexingPage || !indexPagePath.trim()}
                className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                {indexingPage ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {indexingPage ? "Indexing..." : "Index Page"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Search Tab */}
      {tab === "search" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <Input
                  className="pl-10"
                  placeholder="Try: 'offshore diving rates' or 'NDT certification requirements'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </Button>
            </div>

            {/* Method selector */}
            <div className="flex gap-2">
              {(["hybrid", "semantic", "keyword"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSearchMethod(m)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    searchMethod === m
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#64748b]">{searchResults.length} results</p>
              </div>
              {searchResults.map((r, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0f172a] truncate">
                        {r.heading || r.source_path || "Unknown source"}
                      </p>
                      {r.source_path && r.heading && (
                        <p className="text-xs text-[#94a3b8] truncate">{r.source_path}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {r.modality && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.modality === "image"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-[#0ea5e9]/10 text-[#0ea5e9]"
                        }`}>
                          {r.modality}
                        </span>
                      )}
                      <span className="rounded-full bg-[#1e3a5f]/10 px-2 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                        {r.score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#64748b] leading-relaxed line-clamp-3">{r.content}</p>
                  {r.method && (
                    <p className="mt-2 text-[10px] text-[#94a3b8]">
                      via {r.method} ({r.route})
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="py-8 text-center text-sm text-[#94a3b8]">
              No results yet. Enter a query and hit Search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
