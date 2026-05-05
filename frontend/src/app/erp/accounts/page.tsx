"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { DollarSign } from "lucide-react";

export default function AccountsPage() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [accRes, invRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/accounts`),
          throttledFetch(`${API_BASE}/erp/invoices`),
        ]);
        if (accRes.ok) setAccounts(unwrapPaginated(await accRes.json()));
        if (invRes.ok) setInvoices(unwrapPaginated(await invRes.json()));
      } catch (e) {
        console.error("Failed to load accounts:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading accounts...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Accounts</h2>
        </div>
      </div>

      {/* Stats */}
      <div className={isMobile ? "grid grid-cols-2 gap-3 mb-6" : "grid grid-cols-4 gap-4 mb-6"}>
        {[
          { label: "Accounts", value: accounts.length, color: "text-primary" },
          { label: "Invoices", value: invoices.length, color: "text-sonar" },
          { label: "Receivable", value: "AED 0", color: "text-amber" },
          { label: "VAT (5%)", value: "UAE", color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Chart of Accounts</h3>
        </div>
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No accounts yet</div>
        ) : isMobile ? (
          <div className="divide-y">
            {accounts.map((a) => (
              <div key={a.id} className="p-3">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.account_type} · Balance: {a.balance || 0}</p>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Balance</th>
                <th className="px-4 py-2">Currency</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-foreground">{a.account_type}</td>
                  <td className="px-4 py-3 text-foreground">{a.balance || 0}</td>
                  <td className="px-4 py-3 text-foreground">{a.currency || "AED"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Recent Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No invoices yet</div>
        ) : (
          <div className="divide-y text-sm">
            {invoices.slice(0, 10).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{inv.customer_name || "Invoice"}</p>
                  <p className="text-xs text-muted-foreground">{inv.status}</p>
                </div>
                <span className="font-medium text-sonar">AED {inv.total || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
