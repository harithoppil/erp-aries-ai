'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Search, FileText, Building2, User, Package, ShoppingCart, ArrowRight } from 'lucide-react';
import {
  globalSearch,
  type GlobalSearchResult,
} from '@/app/dashboard/erp/global-search-actions';

function getDocIcon(doctype: string): JSX.Element {
  if (doctype.includes('customer') || doctype.includes('supplier') || doctype.includes('lead'))
    return <User className="h-4 w-4 shrink-0" />;
  if (doctype.includes('item') || doctype.includes('product') || doctype.includes('brand'))
    return <Package className="h-4 w-4 shrink-0" />;
  if (doctype.includes('sales') || doctype.includes('purchase') || doctype.includes('order') || doctype.includes('invoice') || doctype.includes('quotation'))
    return <ShoppingCart className="h-4 w-4 shrink-0" />;
  if (doctype.includes('company') || doctype.includes('account') || doctype.includes('cost'))
    return <Building2 className="h-4 w-4 shrink-0" />;
  return <FileText className="h-4 w-4 shrink-0" />;
}

function SearchResultsSkeleton(): JSX.Element {
  return (
    <div className="space-y-3 p-2">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function ERPGlobalSearch(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await globalSearch(query);
      if (res.success) {
        setResults(res.results);
        setSearchCount(res.results.length);
      }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const navigateTo = useCallback((result: GlobalSearchResult) => {
    setOpen(false);
    setQuery('');
    router.push(`/dashboard/erp/${result.doctype}/${encodeURIComponent(result.name)}`);
  }, [router]);

  const navigateToList = useCallback((doctype: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/dashboard/erp/${doctype}`);
  }, [router]);

  const grouped = results.reduce<Record<string, GlobalSearchResult[]>>((acc, r) => {
    if (!acc[r.doctype]) acc[r.doctype] = [];
    acc[r.doctype].push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        {!isMobile && <span>Search ERP...</span>}
        {!isMobile && (
          <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        )}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search records, doctypes, reports..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && <SearchResultsSkeleton />}
          {!loading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
          )}
          {!loading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
          {!loading && Object.entries(grouped).map(([doctype, items]) => (
            <CommandGroup key={doctype} heading={items[0]?.doctypeLabel || doctype}>
              {items.map((item) => (
                <CommandItem
                  key={`${item.doctype}-${item.name}`}
                  value={`${item.doctype}-${item.name}-${item.label}`}
                  onSelect={() => navigateTo(item)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {getDocIcon(item.doctype)}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{item.name}</span>
                    {item.label && item.label !== item.name && (
                      <span className="text-muted-foreground text-xs ml-2">{item.label}</span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{doctype}</Badge>
                </CommandItem>
              ))}
              {items.length > 0 && (
                <CommandItem
                  value={`list-${doctype}`}
                  onSelect={() => navigateToList(doctype)}
                  className="flex items-center gap-2 text-muted-foreground cursor-pointer"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-xs">View all {items[0]?.doctypeLabel || doctype}</span>
                </CommandItem>
              )}
            </CommandGroup>
          ))}
          {!loading && Object.keys(grouped).length > 1 && (
            <>
              <CommandSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                {searchCount} result{searchCount !== 1 ? 's' : ''} across {Object.keys(grouped).length} doctype(s)
              </div>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
