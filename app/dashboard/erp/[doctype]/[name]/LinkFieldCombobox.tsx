'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchDoctypeNames, type LinkSearchResult } from './actions';

interface LinkFieldComboboxProps {
  /** The doctype this field links to (e.g. "Customer", "Item"). */
  linkTo: string;
  /** Current value (the FK record's `name` field). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  /** Extra Prisma where-clause filters derived from link_filters metadata. */
  extraFilters?: Record<string, unknown> | null;
}

export function LinkFieldCombobox({
  linkTo,
  value,
  onChange,
  placeholder,
  className,
  hasError,
  extraFilters,
}: LinkFieldComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LinkSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  // Resolve the label for the current `value` when the popover is closed.
  // Runs once on mount + any time `value` changes via external means.
  useEffect(() => {
    if (!value || !linkTo) {
      setSelectedLabel('');
      return;
    }
    let cancelled = false;
    searchDoctypeNames(linkTo, value, 1, extraFilters).then((result) => {
      if (cancelled) return;
      if (result.success) {
        const exact = result.data.find((r) => r.name === value);
        setSelectedLabel(exact?.label ?? '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, linkTo, extraFilters]);

  // Debounced server search
  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const myReqId = ++reqIdRef.current;
        setLoading(true);
        const result = await searchDoctypeNames(linkTo, q, 20, extraFilters);
        if (myReqId !== reqIdRef.current) return; // stale
        setLoading(false);
        if (result.success) setResults(result.data);
        else setResults([]);
      }, 250);
    },
    [linkTo, extraFilters],
  );

  // Trigger initial search when popover opens
  useEffect(() => {
    if (open) runSearch(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelect = (selected: string) => {
    onChange(selected);
    const match = results.find((r) => r.name === selected);
    if (match) setSelectedLabel(match.label);
    setOpen(false);
  };

  const display = value ? (selectedLabel ? `${value} — ${selectedLabel}` : value) : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-expanded={open}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground font-normal',
          value && 'font-normal',
          hasError && 'border-red-500 focus-visible:ring-red-500/50',
          className,
        )}
      >
        <span className="truncate text-left">{display || placeholder || `Select ${linkTo}…`}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] min-w-[16rem] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${linkTo}…`}
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              runSearch(v);
            }}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Searching…
              </div>
            )}
            {!loading && results.length === 0 && (
              <CommandEmpty>
                {query
                  ? `No ${linkTo} found. Press Enter to use "${query}" anyway.`
                  : `No ${linkTo} records yet.`}
              </CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup>
                {results.map((result) => (
                  <CommandItem
                    key={result.name}
                    value={result.name}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === result.name ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{result.name}</span>
                      {result.label && (
                        <span className="text-xs text-muted-foreground">{result.label}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {/* Allow free-typing fallback for advanced users / unmatched IDs */}
            {!loading && query && !results.some((r) => r.name === query) && (
              <CommandGroup heading="Free entry">
                <CommandItem value={`__free_${query}`} onSelect={() => handleSelect(query)}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Use "{query}" as-is
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
