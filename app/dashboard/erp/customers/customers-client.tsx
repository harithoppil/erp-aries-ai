"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  type ClientSafeCustomer,
} from "@/app/dashboard/erp/customers/actions";
import { usePageContext } from "@/hooks/usePageContext";
import { useAppStore } from "@/store/useAppStore";
import {
  Building2, Search, Plus, Mail, Phone, MapPin,
  CheckCircle, XCircle, DollarSign, Loader2,
  Sparkles, Wand2, Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/export-csv";
import { useActionDispatcher, defineAction } from "@/store/useActionDispatcher";

const INDUSTRY_COLORS: Record<string, string> = {
  oil_gas: "bg-blue-100 text-blue-700 border-blue-200",
  marine: "bg-cyan-100 text-cyan-700 border-cyan-200",
  renewable: "bg-green-100 text-green-700 border-green-200",
  construction: "bg-orange-100 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

interface CustomersClientProps {
  initialCustomers: ClientSafeCustomer[];
}

export default function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<ClientSafeCustomer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track which field was last filled by AI (for visual highlight)
  const [aiFilledField, setAiFilledField] = useState<string | null>(null);
  const [aiActive, setAiActive] = useState(false);

  // AI page context
  const contextSummary = customers.length > 0
    ? `Customers page: ${customers.length} customers total. ${customers.filter(c => c.status === "active").length} active. Recent: ${customers.slice(0, 3).map(c => c.customer_name).join(", ")}.`
    : "Customers page: No customers loaded.";
  usePageContext(contextSummary);

  const [form, setForm] = useState({
    customer_name: "", customer_code: "", contact_person: "",
    email: "", phone: "", address: "", industry: "", tax_id: "", credit_limit: "",
  });

  // Register AI UI actions for this page — typed schema mirrors form validation
  const { registerActions, unregisterActions } = useActionDispatcher();
  useEffect(() => {
    registerActions(
      [
        defineAction({
          name: "create_customer",
          description: "Open and fill the create customer form with the provided details. Opens dialog and fills all fields in one shot.",
          parameters: {
            type: "object",
            required: ["customer_name", "customer_code"],
            properties: {
              customer_name: { type: "string", description: "Customer name (required)" },
              customer_code: { type: "string", description: "Unique customer code (required)" },
              contact_person: { type: "string", description: "Contact person name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              address: { type: "string", description: "Business address" },
              industry: { type: "string", description: "Industry sector", enum: ["oil_gas", "marine", "renewable", "construction", "other"] },
              tax_id: { type: "string", description: "Tax ID / TRN number" },
              credit_limit: { type: "number", description: "Credit limit in AED" },
            },
          },
        }),
        defineAction({
          name: "set_customer_search",
          description: "Filter the customer list by search term",
          parameters: {
            type: "object",
            required: ["term"],
            properties: {
              term: { type: "string", description: "Search term to filter by" },
            },
          },
        }),
        defineAction({
          name: "navigate_to_customer",
          description: "Navigate to a specific customer's detail page",
          parameters: {
            type: "object",
            required: ["customer_id"],
            properties: {
              customer_id: { type: "string", description: "Customer UUID to navigate to" },
            },
          },
        }),
      ],
      {
        // One-shot handler: opens dialog AND fills all provided fields
        create_customer: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          setDialogOpen(true);
          setForm((prev) => ({
            ...prev,
            customer_name: a.customer_name || prev.customer_name,
            customer_code: a.customer_code || prev.customer_code,
            contact_person: a.contact_person || prev.contact_person,
            email: a.email || prev.email,
            phone: a.phone || prev.phone,
            address: a.address || prev.address,
            industry: a.industry || prev.industry,
            tax_id: a.tax_id || prev.tax_id,
            credit_limit: a.credit_limit != null ? String(a.credit_limit) : prev.credit_limit,
          }));
          // Briefly highlight all filled fields
          const filledFields = Object.keys(args).filter(k => k !== "customer_name" && k !== "customer_code");
          if (filledFields.length > 0) {
            setAiFilledField(filledFields[0]);
            setTimeout(() => setAiFilledField(null), 1200);
          }
          toast.info("AI opened and filled the customer form", { icon: <Wand2 size={14} /> });
        },
        set_customer_search: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          setSearch(a.term);
          toast.info(`AI filtered customers by "${a.term}"`, { icon: <Sparkles size={14} /> });
        },
        navigate_to_customer: (args: Record<string, unknown>) => {
          const a = args as Record<string, string>;
          router.push(`/dashboard/erp/customers/${a.customer_id}`);
        },
      }
    );
    return () => unregisterActions();
  }, [registerActions, unregisterActions, router]);

  // Listen to global AI action state for visual feedback
  const uiActionActive = useAppStore((s) => s.uiActionActive);
  useEffect(() => {
    setAiActive(uiActionActive);
  }, [uiActionActive]);

  const load = async () => {
    const { listCustomers } = await import("@/app/dashboard/erp/customers/actions");
    const result = await listCustomers();
    if (result.success) {
      setCustomers(result.customers);
    } else {
      toast.error(result.error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await createCustomer({
      ...form,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : undefined,
    });
    if (result.success) {
      toast.success("Customer created");
      setDialogOpen(false);
      setForm({ customer_name: "", customer_code: "", contact_person: "", email: "", phone: "", address: "", industry: "", tax_id: "", credit_limit: "" });
      setCustomers((prev) => [result.customer, ...prev]);
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.customer_name || "").toLowerCase().includes(q) ||
      (c.customer_code || "").toLowerCase().includes(q) ||
      (c.contact_person || "").toLowerCase().includes(q) ||
      (c.industry || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((c) => c.status === "active").length,
      inactive: customers.filter((c) => c.status === "inactive").length,
      withCredit: customers.filter((c) => c.credit_limit).length,
    };
  }, [customers]);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* AI Activity Indicator */}
      {aiActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-sm animate-pulse">
          <Sparkles size={14} className="animate-spin" />
          <span>AI is controlling the interface...</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Customers</h2>
              <p className="text-sm text-[#64748b] mt-1">{customers.length} total customers</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => exportToCSV(filtered.map(c => ({ customer_name: c.customer_name, code: c.customer_code, industry: c.industry, contact_person: c.contact_person, email: c.email, phone: c.phone, tax_id: c.tax_id, credit_limit: c.credit_limit, status: c.status })), 'customers')}>
                <Download size={16} /> Export CSV
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
                <Plus size={16} /> Add Customer
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search customers by name, code, or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Total" value={stats.total} color="text-[#64748b]" />
            <StatCard icon={CheckCircle} label="Active" value={stats.active} color="text-green-600" />
            <StatCard icon={XCircle} label="Inactive" value={stats.inactive} color="text-gray-500" />
            <StatCard icon={DollarSign} label="With Credit Limit" value={stats.withCredit} color="text-blue-600" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
                <Building2 size={48} className="mb-4 opacity-40" />
                <p className="text-lg font-medium">No customers found</p>
                <p className="text-sm">Add your first customer to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Customer</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Code</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Industry</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Contact</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Tax ID</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Credit Limit</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((c) => {
                      const indColor = INDUSTRY_COLORS[c.industry || ""] || INDUSTRY_COLORS.other;
                      return (
                        <tr key={c.id} onClick={() => router.push(`/dashboard/erp/customers/${c.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0f172a]">{c.customer_name}</p>
                            {c.address && (
                              <p className="text-xs text-[#94a3b8] flex items-center gap-1">
                                <MapPin size={10} /> {c.address}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{c.customer_code}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${indColor}`}>
                              {c.industry?.replace(/_/g, " ") || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {c.contact_person && <p className="text-[#64748b]">{c.contact_person}</p>}
                              {c.email && <p className="text-xs text-[#94a3b8] flex items-center gap-1"><Mail size={10} /> {c.email}</p>}
                              {c.phone && <p className="text-xs text-[#94a3b8] flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{c.tax_id || "—"}</td>
                          <td className="px-4 py-3 text-[#0f172a] font-medium">
                            {c.credit_limit ? `AED ${c.credit_limit.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                              c.status === "active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}>
                              {c.status === "active" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                              {c.status}
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

      {/* Add Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Add New Customer
              {aiActive && <Sparkles size={16} className="text-indigo-500 animate-pulse" />}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Customer Name *</label>
                <Input
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className={aiFilledField === "customer_name" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Customer Code *</label>
                <Input
                  required
                  value={form.customer_code}
                  onChange={(e) => setForm({ ...form, customer_code: e.target.value })}
                  className={aiFilledField === "customer_code" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Contact Person</label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className={aiFilledField === "contact_person" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={aiFilledField === "email" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={aiFilledField === "phone" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={aiFilledField === "address" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Industry</label>
                <select
                  className={`w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm ${
                    aiFilledField === "industry" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""
                  }`}
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="oil_gas">Oil &amp; Gas</option>
                  <option value="marine">Marine</option>
                  <option value="renewable">Renewable Energy</option>
                  <option value="construction">Construction</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Tax ID (TRN)</label>
                <Input
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  className={aiFilledField === "tax_id" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Credit Limit (AED)</label>
              <Input
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                className={aiFilledField === "credit_limit" ? "ring-2 ring-indigo-400 border-indigo-400 transition-all duration-500" : ""}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">{saving ? "Saving..." : "Create Customer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs font-medium text-[#64748b] uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
