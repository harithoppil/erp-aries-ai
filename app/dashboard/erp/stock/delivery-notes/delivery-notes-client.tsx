"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { listDeliveryNotes, createDeliveryNote, type ClientSafeDeliveryNote } from "./actions";
import { usePageContext } from "@/hooks/usePageContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Truck, Search, Plus, List, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ExportButton from "@/app/dashboard/erp/components/ExportButton";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  Draft: { label: "Draft", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  Submitted: { label: "Submitted", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  Cancelled: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200" },
};

const fmt = (v: number, ccy = "AED") =>
  v.toLocaleString("en-AE", { style: "currency", currency: ccy });
const dateFmt = (s: string | Date | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function DeliveryNotesClient({
  initialNotes,
}: {
  initialNotes: ClientSafeDeliveryNote[];
}) {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [notes, setNotes] = useState<ClientSafeDeliveryNote[]>(initialNotes);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    id: "",
    customer: "",
    customerName: "",
    company: "",
    status: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer: "",
    posting_date: "",
    item_code: "",
    qty: "1",
    rate: "",
  });

  usePageContext(`Delivery Notes: ${notes.length} notes`);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter((n) => {
      const matchesSearch =
        !q ||
        (n.name || "").toLowerCase().includes(q) ||
        (n.customer_name || "").toLowerCase().includes(q) ||
        (n.customer || "").toLowerCase().includes(q);
      const matchesId =
        !filters.id || (n.name || "").toLowerCase().includes(filters.id.toLowerCase());
      const matchesCustomer =
        !filters.customer ||
        (n.customer || "").toLowerCase().includes(filters.customer.toLowerCase());
      const matchesCustomerName =
        !filters.customerName ||
        (n.customer_name || "")
          .toLowerCase()
          .includes(filters.customerName.toLowerCase());
      const matchesCompany =
        !filters.company ||
        (n.company || "").toLowerCase().includes(filters.company.toLowerCase());
      const matchesStatus =
        !filters.status ||
        (n.status || "").toLowerCase().includes(filters.status.toLowerCase());
      return (
        matchesSearch &&
        matchesId &&
        matchesCustomer &&
        matchesCustomerName &&
        matchesCompany &&
        matchesStatus
      );
    });
  }, [notes, search, filters]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createDeliveryNote({
      customer: form.customer,
      posting_date: form.posting_date || undefined,
      items: [
        {
          item_code: form.item_code,
          qty: parseFloat(form.qty),
          rate: parseFloat(form.rate),
        },
      ],
    });
    if (result.success) {
      toast.success("Delivery Note created");
      setDialogOpen(false);
      setForm({ customer: "", posting_date: "", item_code: "", qty: "1", rate: "" });
      const res = await listDeliveryNotes();
      if (res.success) setNotes(res.notes);
    } else {
      toast.error(result.error || "Failed to create");
    }
    setSaving(false);
  };

  const clearFilters = () => {
    setFilters({ id: "", customer: "", customerName: "", company: "", status: "" });
    setSearch("");
  };

  const hasActiveFilters =
    filters.id || filters.customer || filters.customerName || filters.company || filters.status;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/erp/stock">Stock</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Delivery Note</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header with action bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Delivery Notes</h2>
              <p className="text-sm text-[#64748b] mt-1">
                {filtered.length} of {notes.length} delivery notes
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
                <List size={14} />
                List View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`gap-1.5 text-xs h-9 ${showFilters ? "bg-gray-100" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={14} />
                Filters
              </Button>
              <ExportButton
                data={filtered.map((n) => ({
                  name: n.name,
                  customer: n.customer_name,
                  date: dateFmt(n.posting_date),
                  total: n.grand_total,
                  status: n.status,
                }))}
                filename="delivery-notes"
              />
              <Button
                onClick={() => setDialogOpen(true)}
                className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                <Plus size={16} /> New Delivery Note
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search by name, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div
                className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-5"} gap-3`}
              >
                <div>
                  <label className="text-xs font-medium text-[#64748b] mb-1 block">ID</label>
                  <Input
                    placeholder="Filter by ID..."
                    value={filters.id}
                    onChange={(e) => setFilters({ ...filters, id: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748b] mb-1 block">
                    Customer
                  </label>
                  <Input
                    placeholder="Customer code..."
                    value={filters.customer}
                    onChange={(e) =>
                      setFilters({ ...filters, customer: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748b] mb-1 block">
                    Customer Name
                  </label>
                  <Input
                    placeholder="Customer name..."
                    value={filters.customerName}
                    onChange={(e) =>
                      setFilters({ ...filters, customerName: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748b] mb-1 block">
                    Company
                  </label>
                  <Input
                    placeholder="Company..."
                    value={filters.company}
                    onChange={(e) =>
                      setFilters({ ...filters, company: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748b] mb-1 block">
                    Status
                  </label>
                  <Input
                    placeholder="Draft, Submitted..."
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[#64748b]"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Truck size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No delivery notes found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Date</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">
                        Grand Total
                      </th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((n) => {
                      const cfg = STATUS_CONFIG[n.status] || STATUS_CONFIG.Draft;
                      return (
                        <tr
                          key={n.name}
                          onClick={() =>
                            router.push(
                              `/dashboard/erp/stock/delivery-notes/${n.name}`,
                            )
                          }
                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">
                            {n.name}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#0f172a]">
                            {n.customer_name || n.customer}
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">
                            {dateFmt(n.posting_date)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {fmt(n.grand_total, n.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cfg.badge}`}
                            >
                              {cfg.label}
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
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Delivery Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Customer</label>
              <Input
                required
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Posting Date</label>
              <Input
                type="date"
                value={form.posting_date}
                onChange={(e) => setForm({ ...form, posting_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Item Code</label>
              <Input
                required
                value={form.item_code}
                onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                placeholder="Item code"
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
                <label className="text-sm font-medium">Rate</label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#1e3a5f] hover:bg-[#152a45]"
              >
                {saving ? "Saving..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
