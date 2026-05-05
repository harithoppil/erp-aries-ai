"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-responsive";
import { API_BASE, unwrapPaginated } from "@/lib/api";
import { throttledFetch } from "@/lib/throttledFetch";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await throttledFetch(`${API_BASE}/erp/projects`);
        if (res.ok) setProjects(unwrapPaginated(await res.json()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading projects...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <FolderKanban className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Projects & Operations</h2>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3"><h3 className="font-semibold">Projects</h3></div>
        {projects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No projects yet</div>
        ) : (
          <div className="divide-y text-sm">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.project_type} · Day rate: {p.day_rate || "TBD"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "active" ? "bg-primary/15 text-primary" :
                  p.status === "completed" ? "bg-primary/15 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
