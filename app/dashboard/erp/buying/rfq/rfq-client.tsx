"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listRFQs, createRFQ, type ClientSafeRFQ } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  FileQuestion, Search, Plus, Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

const dt = (s: string | Date | null) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const DOCTYPE_STATUS_MAP: Record<number, { label: string; badge: string }> = {
  0: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  1: { label: "Submitted", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  2: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};

// ── Mobile RFQ Card ─────────────────────────────────────────────────────────

function MobileRFQCard({
  rfqs,
  onRowClick,
}: {
  rfqs: ClientSafeRFQ[];
  onRowClick: (name: string) => void;
}) {
  if (rfqs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
        <FileQuestion size={48} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">No RFQs found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rfqs.map((r) => {
        const docConfig = DOCTYPE_STATUS_MAP[r.docstatus] || DOCTYPE_STATUS_MAP[0];
        return (
          <Card
            key={r.name}
            className="rounded-2xl border-gray-100 shadow-sm cursor-pointer hover:border-gray-200 transition-colors"
            onClick={() => onRowClick(r.name)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-xs text-[#64748b]">{r.name}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${docConfig.badge}`}>
                  {r.status || docConfig.label}
                </span>
              </div>
              <p className="text-sm font-medium text-[#0f172a] mb-1">{r.company}</p>
              <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
                <span>Date: {dt(r.transaction_date)}</span>
                {r.schedule_date && <span>Schedule: {dt(r.schedule_date)}</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Desktop RFQ DataTable ───────────────────────────────────────────────────

function DesktopRFQDataTable({
  rfqs,
  onRowClick,
}: {
  rfqs: ClientSafeRFQ[];
  onRowClick: (name: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {rfqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
          <FileQuestion size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">No RFQs found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th>
                <th className="text-left px-4 py-3 text-gray-700 font-semibold">Company</th>
                <th className="text-left px-4 py-3 text-gray-700 font-semibold">Supplier</th>
                <th className="text-left px-4 py-3 text-gray-700 font-semibold">Transaction Date</th>
                <th className="text-left px-4 py-3 text-gray-700 font-semibold">Schedule Date</th>
                <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rfqs.map((r) => {
                const docConfig = DOCTYPE_STATUS_MAP[r.docstatus] || DOCTYPE_STATUS_MAP[0];
                return (
                  <tr
                    key={r.name}
                    onClick={() => onRowClick(r.name)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{r.name}</td>
                    <td className="px-4 py-3 font-medium text-[#0f172a]">{r.company}</td>
                    <td className="px-4 py-3 text-[#64748b]">{r.opportunity || "—"}</td>
                    <td className="px-4 py-3 text-[#64748b]">{dt(r.transaction_date)}</td>
                    <td className="px-4 py-3 text-[#64748b]">{dt(r.schedule_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${docConfig.badge}`}>
                        {r.status || docConfig.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function RfqClient({ initialRfqs }: { initialRfqs: ClientSafeRFQ[] }) {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [rfqs, setRfqs] = useState<ClientSafeRFQ[]>(initialRfqs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    item_code: "",
    qty: "1",
    uom: "Nos",
    schedule_date: "",
    message_for_supplier: "",
  });

  usePageContext(`RFQs: ${rfqs.length} requests for quotation`);

  const filtered = useMemo(() => {
    let result = rfqs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          !q ||
          (r.name || "").toLowerCase().includes(q) ||
          (r.company || "").toLowerCase().includes(q) ||
          (r.opportunity || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((r) => (r.status || "Draft") === statusFilter);
    }
    return result;
  }, [rfqs, search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createRFQ({
      items: [
        {
          item_code: form.item_code,
          qty: parseFloat(form.qty),
          uom: form.uom,
          schedule_date: form.schedule_date || undefined,
        },
      ],
      message_for_supplier: form.message_for_supplier || undefined,
    });
    if (result.success) {
      toast.success("RFQ created");
      setDialogOpen(false);
      setForm({ item_code: "", qty: "1", uom: "Nos", schedule_date: "", message_for_supplier: "" });
      const res = await listRFQs();
      if (res.success) setRfqs(res.rfqs);
    } else {
      toast.error(result.error || "Failed");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={() => <Link href="/dashboard/erp/buying">Buying</Link>} />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Request for Quotation</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Request for Quotation</h2>
              <p className="text-sm text-[#64748b] mt-1">{filtered.length} RFQs</p>
            </div>
            <div className="flex gap-2">
              <ExportButton
                data={filtered.map((r) => ({
                  id: r.name,
                  company: r.company,
                  transaction_date: dt(r.transaction_date),
                  schedule_date: dt(r.schedule_date),
                  status: r.status || "Draft",
                }))}
                filename="rfqs"
              />
              <Button
                onClick={() => setDialogOpen(true)}
                className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                <Plus size={16} />
                New RFQ
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <Input
                placeholder="Search by ID, company, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-gray-200"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Received">Received</option>
            </select>
          </div>

          {/* Data */}
          {isMobile ? (
            <MobileRFQCard rfqs={filtered} onRowClick={(n) => router.push(`/dashboard/erp/buying/rfq/${n}`)} />
          ) : (
            <DesktopRFQDataTable rfqs={filtered} onRowClick={(n) => router.push(`/dashboard/erp/buying/rfq/${n}`)} />
          )}
        </div>
      </div>

      {/* Create RFQ Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Request for Quotation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Item Code</label>
              <Input
                required
                value={form.item_code}
                onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                placeholder="Item to request quotes for"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Qty</label>
                <Input
                  type="number"
                  required
                  min="1"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">UOM</label>
                <Input
                  value={form.uom}
                  onChange={(e) => setForm({ ...form, uom: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Schedule Date</label>
              <Input
                type="date"
                value={form.schedule_date}
                onChange={(e) => setForm({ ...form, schedule_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message to Suppliers</label>
              <textarea
                className="w-full h-20 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={form.message_for_supplier}
                onChange={(e) => setForm({ ...form, message_for_supplier: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">
                {saving ? "Saving..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
