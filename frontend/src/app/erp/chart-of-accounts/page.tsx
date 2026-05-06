"use client";

import { useState, useEffect, useMemo } from "react";
import { API_BASE } from "@/lib/api";
import { TreePine, ChevronRight, ChevronDown, Search, Folder, FileText, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

interface Account {
  id: string;
  name: string;
  account_number: string | null;
  account_type: string | null;
  root_type: string;
  parent_account: string | null;
  is_group: boolean;
  balance: number;
  lft: number;
  rgt: number;
  level: number;
  has_children: boolean;
}

const ROOT_COLORS: Record<string, string> = {
  Asset: "text-blue-600",
  Liability: "text-red-600",
  Equity: "text-purple-600",
  Income: "text-green-600",
  Expense: "text-orange-600",
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API_BASE}/erp/accounts/tree?company=Aries%20Marine`)
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data.accounts || []);
        const roots = new Set<string>();
        data.accounts?.forEach((a: Account) => { if (a.level === 0) roots.add(a.id); });
        setExpanded(roots);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.account_number?.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visible = useMemo(() => {
    if (search.trim()) return filtered;
    const result: Account[] = [];
    const skipUntilRgt = new Map<number, number>();
    for (const a of accounts) {
      let hidden = false;
      for (let lv = 0; lv < a.level; lv++) {
        if (skipUntilRgt.has(lv) && a.rgt <= (skipUntilRgt.get(lv) || 0)) { hidden = true; break; }
      }
      if (hidden) continue;
      result.push(a);
      if (!expanded.has(a.id) && a.has_children) skipUntilRgt.set(a.level, a.rgt);
      else skipUntilRgt.delete(a.level);
    }
    return result;
  }, [accounts, expanded, search, filtered]);

  const renderSkeletons = () =>
    Array.from({ length: 8 }).map((_, i) => (
      <TableRow key={`skel-${i}`}>
        <TableCell><Skeleton className="h-4 w-56" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
        <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
      </TableRow>
    ));

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
            <TreePine className="h-6 w-6 text-[#0ea5e9]" />
            Chart of Accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{accounts.length} accounts — Aries Marine</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead className="w-24">Number</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="text-right w-32">Balance (AED)</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                renderSkeletons()
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <SearchX className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Accounts Found</h3>
                    <p className="mt-1 text-muted-foreground">
                      {search ? "Try adjusting your search." : "No accounts available."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2" style={{ paddingLeft: `${a.level * 20}px` }}>
                        {a.has_children ? (
                          <button onClick={() => toggleExpand(a.id)} className="text-muted-foreground hover:text-foreground">
                            {expanded.has(a.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                        {a.is_group ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                        <span className={a.is_group ? "font-semibold text-foreground" : "text-muted-foreground"}>{a.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.account_number || "—"}</TableCell>
                    <TableCell className={`font-medium ${ROOT_COLORS[a.root_type] || "text-muted-foreground"}`}>{a.root_type}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {a.balance !== 0 ? a.balance.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.is_group && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Group</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
