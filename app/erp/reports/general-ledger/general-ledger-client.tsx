"use client";

import { useState } from "react";
import { getGeneralLedger, type GLEntry } from "../actions";
import { ScrollText, Calendar, Search, Filter, FileX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface GeneralLedgerClientProps {
  initialEntries: GLEntry[];
  initialTotal: { debit: number; credit: number };
}

export default function GeneralLedgerClient({ initialEntries, initialTotal }: GeneralLedgerClientProps) {
  const [entries, setEntries] = useState<GLEntry[]>(initialEntries);
  const [fetching, setFetching] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [voucherNo, setVoucherNo] = useState("");
  const [total, setTotal] = useState(initialTotal.debit + initialTotal.credit);

  const fetchData = async () => {
    setFetching(true);
    try {
      const result = await getGeneralLedger({
        from_date: fromDate,
        to_date: toDate,
        voucher_no: voucherNo || undefined,
      });
      if (result.success) {
        setEntries(result.entries);
        setTotal(result.total.debit + result.total.credit);
      }
    } catch (e) { console.error(e); } finally { setFetching(false); }
  };

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
          <ScrollText className="h-6 w-6 text-[#0ea5e9]" />
          General Ledger
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">All journal entries, invoices, and payments posted to accounts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Debit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#0f172a]">{totalDebit.toLocaleString("en-AE", { style: "currency", currency: "AED" })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#0f172a]">{totalCredit.toLocaleString("en-AE", { style: "currency", currency: "AED" })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Movement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalDebit - totalCredit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {(totalDebit - totalCredit).toLocaleString("en-AE", { style: "currency", currency: "AED" })}
            </p>
          </CardContent>
        </Card>
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Voucher No</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="e.g. INV-001" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} className="w-40 pl-7" />
              </div>
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
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-36">Voucher</TableHead>
                <TableHead className="w-48">Party</TableHead>
                <TableHead className="text-right w-32">Debit (AED)</TableHead>
                <TableHead className="text-right w-32">Credit (AED)</TableHead>
                <TableHead className="text-right w-32">Balance (AED)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fetching ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-12 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <FileX className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Entries Found</h3>
                    <p className="mt-1 text-muted-foreground">Try adjusting your date range or filters.</p>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(e.posting_date).toLocaleDateString("en-AE")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{e.voucher_type}</Badge>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.voucher_no}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[180px]">{e.party_name || "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">{e.debit > 0 ? e.debit.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">{e.credit > 0 ? e.credit.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums font-medium ${(e.balance ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(e.balance ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Showing {entries.length} of {total} entries</p>
    </div>
  );
}
