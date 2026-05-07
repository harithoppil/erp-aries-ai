"use client";

import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Search input with optional refresh button.
 * Replaces the repeated search bar pattern across all ERP pages.
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  onRefresh,
  refreshing = false,
}: SearchBarProps) {
  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 bg-white border-gray-200"
        />
      </div>
      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-xl"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
        </Button>
      )}
    </div>
  );
}
