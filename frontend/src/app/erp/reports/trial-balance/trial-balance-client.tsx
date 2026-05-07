"use client";

import { useState } from "react";
import { getTrialBalance, type TBAccount } from "../actions";
import { Scale, Calendar, Filter, FileX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ROOT_BADGE: Record<string, string> = {
  Asset: "bg-blue-50 text-blue-700 hover:bg-blue-50",
  Liability: "bg-red-50 text-red-700 hover:bg-red-50",
  Equity: "bg-purple-50 text-purple-700 hover:bg-purple-50",
  Income: "bg-green-50 text-green-700 hover:bg-green-50",
  Expense: "bg-orange-50 text-orange-700 hover:bg-orange-50",
};

interface TrialBalanceClientProps {
  initialAccounts: TBAccount[];
}

export default function TrialBalanceClient({ initialAccounts }: TrialBalanceClientProps) {
  const [accounts, setAccounts] = useState<TBAccount[]>(initialAccounts);
  const [fetching, setFetching] = useState(false);
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-12-31");

  const fetchData = async () => {
    setFetching(true);
    try {
      const result = await getTrialBalance({ from_date: fromDate, to_date: toDate });
      if (result.success) setAccounts(result.accounts);
    } catch (e) { console.error(e); } finally { setFetching(false); }
  };

  const totals = accounts.reduce((acc, a) => ({
    opDr: acc.opDr + (a.opening_debit ?? a.opening_dr ?? 0), opCr: acc.opCr + (a.opening_credit ?? a.opening_cr ?? 0),
    dr: acc.dr + a.debit, cr: acc.cr + a.credit,
    clDr: acc.clDr + (a.closing_debit ?? a.closing_dr ?? 0), clCr: acc.clCr + (a.closing_credit ?? a.closing_cr ?? 0),
  }), { opDr: 0, opCr: 0, dr: 0, cr: 0, clDr: 0, clCr: 0 });

  const fmt = (n: number) => n > 0 ? n.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—";

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
          <Scale className="h-6 w-6 text-[#0ea5e9]" />
          Trial Balance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Opening balances, period movements, and closing balances per account</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="block text-xs font-medium text-muted-foreground">From</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
            </div>
            <Button onClick={fetchData} className="bg-[#1e3a5f] hover:bg-[#2d5a87]">
              <Filter className="mr-1 h-4 w-4" /> Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-center w-24">Type</TableHead>
                <TableHead className="text-right w-28">Opening Dr</TableHead>
                <TableHead className="text-right w-28">Opening Cr</TableHead>
                <TableHead className="text-right w-28">Debit</TableHead>
                <TableHead className="text-right w-28">Credit</TableHead>
                <TableHead className="text-right w-28">Closing Dr</TableHead>
                <TableHead className="text-right w-28">Closing Cr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fetching ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-12 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <FileX className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Data</h3>
                    <p className="mt-1 text-muted-foreground">Try adjusting your date range.</p>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {accounts.map((a, idx) => (
                    <TableRow key={a.id || idx}>
                      <TableCell>
                        <span className="font-medium text-foreground">{a.name || a.account || "—"}</span>
                        {a.account_number && <span className="ml-2 text-xs text-muted-foreground">#{a.account_number}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className={`text-[10px] ${ROOT_BADGE[a.root_type || ""] || ""}`}>{a.root_type || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{fmt(a.opening_debit ?? a.opening_dr ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{fmt(a.opening_credit ?? a.opening_cr ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">{fmt(a.debit)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">{fmt(a.credit)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-foreground">{fmt(a.closing_debit ?? a.closing_dr ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-foreground">{fmt(a.closing_credit ?? a.closing_cr ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border bg-muted/50 font-bold text-foreground">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(totals.opDr)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(totals.opCr)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(totals.dr)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(totals.cr)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(totals.clDr)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmt(totals.clCr)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
