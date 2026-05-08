"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { listNotebooks, createNotebook, deleteNotebook, type NotebookRead } from "@/app/dashboard/notebooks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText, Plus, Search, Trash2, Clock, BookOpen,
} from "lucide-react";

const CARD_COLORS = [
  "bg-blue-50 border-blue-200 hover:border-blue-300",
  "bg-emerald-50 border-emerald-200 hover:border-emerald-300",
  "bg-amber-50 border-amber-200 hover:border-amber-300",
  "bg-rose-50 border-rose-200 hover:border-rose-300",
  "bg-violet-50 border-violet-200 hover:border-violet-300",
  "bg-cyan-50 border-cyan-200 hover:border-cyan-300",
];

export default function NotebooksPage() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<NotebookRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await listNotebooks();
      if (result.success) {
        setNotebooks(result.notebooks);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load notebooks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createNotebook({ title: newTitle || "Untitled document" });
      if (result.success) {
        setDialogOpen(false);
        setNewTitle("");
        router.push(`/notebooks/editor/${result.notebook.id}`);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error("Failed to create notebook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this notebook?")) return;
    try {
      await deleteNotebook(id);
      toast.success("Notebook deleted");
      load();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const filtered = notebooks.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string | Date) => {
    const d = iso instanceof Date ? iso : new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <BookOpen className="h-4 w-4 text-[#1e3a5f]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">Notebooks</h2>
                <p className="text-xs text-[#64748b]">{notebooks.length} documents</p>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl bg-[#1e3a5f] hover:bg-[#152a45]">
              <Plus size={16} /> New Document
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              placeholder="Search notebooks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
              <FileText size={48} className="mb-4 opacity-40" />
              <p className="text-lg font-medium">No notebooks yet</p>
              <p className="text-sm">Create your first document to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((n, i) => (
                <div
                  key={n.id}
                  onClick={() => router.push(`/notebooks/editor/${n.id}`)}
                  className={`group cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <FileText className="h-6 w-6 text-[#64748b]" />
                    <button
                      onClick={(e) => handleDelete(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3 className="text-sm font-semibold text-[#0f172a] line-clamp-2 mb-2">{n.title}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-[#94a3b8]">
                    <Clock size={10} />
                    <span>Edited {formatDate(n.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create New Document</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Untitled document"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152a45]">
                {saving ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
