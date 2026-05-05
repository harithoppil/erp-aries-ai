"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { Users, AlertTriangle } from "lucide-react";

export default function HRPage() {
  const isMobile = useIsMobile();
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/personnel`),
          throttledFetch(`${API_BASE}/erp/personnel/compliance-alerts`),
        ]);
        if (pRes.ok) setPersonnel(unwrapPaginated(await pRes.json()));
        if (aRes.ok) setAlerts(unwrapPaginated(await aRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading HR...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">HR & Compliance</h2>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/20 bg-amber/10 p-4">
          <div className="flex items-center gap-2 text-amber">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">{alerts.length} compliance alerts</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Personnel</h3></div>
        {personnel.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No personnel registered</div>
        ) : (
          <div className="divide-y text-sm">
            {personnel.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.designation} · {p.department || "No dept"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
