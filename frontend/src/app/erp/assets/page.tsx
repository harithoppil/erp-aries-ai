"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { Wrench, AlertTriangle } from "lucide-react";

export default function AssetsPage() {
  const isMobile = useIsMobile();
  const [assets, setAssets] = useState<any[]>([]);
  const [calibrationDue, setCalibrationDue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, cRes] = await Promise.all([
          throttledFetch(`${API_BASE}/erp/assets`),
          throttledFetch(`${API_BASE}/erp/assets/calibration-due`),
        ]);
        if (aRes.ok) setAssets(unwrapPaginated(await aRes.json()));
        if (cRes.ok) setCalibrationDue(unwrapPaginated(await cRes.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading assets...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Wrench className="h-6 w-6 text-amber" />
        <h2 className="text-2xl font-bold">Assets & Equipment</h2>
      </div>

      {calibrationDue.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/20 bg-amber/10 p-4">
          <div className="flex items-center gap-2 text-amber">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">{calibrationDue.length} assets have calibration due</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Assets</h3></div>
        {assets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No assets registered</div>
        ) : (
          <div className="divide-y text-sm">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.asset_type} · {a.location || "No location"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  a.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
