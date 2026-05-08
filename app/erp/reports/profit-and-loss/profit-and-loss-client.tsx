"use client";

import { useState } from "react";
import { getProfitAndLoss, type PLData, type PLSection } from "../actions";
import { TrendingDown, Calendar, Filter, FileX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const SECTION_STYLES: Record<string, { headerBg: string; headerText: string }> = {
  Income: { headerBg: "bg-green-50", headerText: "text-green-700" },
  Expenses: { headerBg: "bg-orange-50", headerText: "text-orange-700" },
};

interface ProfitAndLossClientProps {
  initialData: PLData | null;
}

export default function ProfitAndLossClient({ initialData }: ProfitAndLossClientProps) {
  const [data, setData] = useState<PLData | null>(initialData);
  const [fetching, setFetching] = useState(false);
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(`${new Date().getFullYear()}-12-31`);

  const fetchData = async () => {
    setFetching(true);
    try {
      const result = await getProfitAndLoss({ from_date: fromDate, to_date: toDate });
      if (result.success) setData(result.data);
    } catch (e) { console.error(e); } finally { setFetching(false); }
  };

  const renderSection = (title: string, section: PLSection) => {
    const s = SECTION_STYLES[title] || { headerBg: "bg-muted", headerText: "text-foreground" };
    return (
      <Card className="overflow-hidden">
        <CardHeader className={`${s.headerBg} border-b pb-3`}>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-sm font-bold uppercase tracking-wider ${s.headerText}`}>{title}</CardTitle>
            <span className="text-lg font-bold text-[#0f172a]">
              {section.total.toLocaleString("en-AE", { style: "currency", currency: "AED" })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {fetching ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right w-40">Balance (AED)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={2} className="h-12 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableBody>
                {section.accounts.map((a, idx) => (
                  <TableRow key={a.id || idx}>
                    <TableCell style={{ paddingLeft: `${20 + (a.level || 0) * 20}px` }}>
                      <span className={a.is_group ? "font-semibold text-foreground" : "text-muted-foreground"}>{a.name || a.account || "—"}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium text-foreground w-40">
                      {(a.balance ?? a.amount ?? 0) !== 0 ? (a.balance ?? a.amount ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className={`${s.headerBg} font-bold`}>
                  <TableCell className="text-foreground">Total {title}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground">
                    {section.total.toLocaleString("en-AE", { style: "currency", currency: "AED" })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f172a]">
            <TrendingDown className="h-6 w-6 text-[#0ea5e9]" />
            Profit & Loss
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Income Statement</p>
        </div>
        <div className="flex items-end gap-3">
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
      </div>

      {!data && !fetching ? (
        <div className="p-8 text-center text-muted-foreground">
          <FileX className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Data</h3>
          <p className="mt-1 text-muted-foreground">Select a date range and click Apply.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {renderSection("Income", data?.income || { accounts: [], total: 0 })}
          {renderSection("Expenses", data?.expenses || { accounts: [], total: 0 })}

          {data && (
            <Card className={data.is_profit ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${data.is_profit ? "text-emerald-800" : "text-red-800"}`}>
                    {data.is_profit ? "Net Profit" : "Net Loss"}
                  </span>
                  <span className={`font-mono text-2xl font-bold ${data.is_profit ? "text-emerald-700" : "text-red-700"}`}>
                    {Math.abs(data.net_profit).toLocaleString("en-AE", { style: "currency", currency: "AED" })}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {data.is_profit ? "Income exceeds expenses" : "Expenses exceed income"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
