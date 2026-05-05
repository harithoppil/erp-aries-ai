"use client";

import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { listWikiPages, getWikiPage, searchWiki } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

export default function WikiPage() {
  const isMobile = useIsMobile();
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ path: string; title: string; snippet: string; score: number }>>([]);

  useEffect(() => {
    listWikiPages().then(setPages);
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

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">LLM Wiki</h2>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 pr-3"
            placeholder="Search wiki..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button onClick={handleSearch} className="rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90">
          Search
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Search Results</h3>
          {searchResults.map((r) => (
            <button
              key={r.path}
              onClick={() => handleSelectPage(r.path)}
              className="mb-2 block w-full rounded-lg p-2 text-left text-sm hover:bg-accent/50"
            >
              <p className="font-medium text-primary">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.snippet.slice(0, 120)}...</p>
            </button>
          ))}
        </div>
      )}

      <div className={isMobile ? "space-y-4" : "grid grid-cols-[280px_1fr] gap-6"}>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Pages</h3>
          <div className="space-y-1">
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => handleSelectPage(p)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                  selectedPage === p ? "bg-primary/10 text-primary" : "hover:bg-accent/50"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          {selectedPage ? (
            <>
              <h3 className="mb-3 font-semibold">{selectedPage}</h3>
              <pre className="whitespace-pre-wrap text-sm text-foreground">{content}</pre>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Select a page to view</div>
          )}
        </div>
      </div>
    </div>
  );
}
