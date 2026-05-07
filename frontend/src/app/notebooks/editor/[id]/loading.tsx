import { Skeleton } from "@/components/ui/skeleton";

export default function NotebookEditorLoading() {
  return (
    <div className="flex h-screen flex-col bg-[#f8fafc]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex flex-col">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-3 w-28 mt-1" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b bg-white px-4 py-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto bg-[#f8fafc] flex justify-center py-8">
          <div className="bg-white shadow-xl" style={{ width: "21cm", minHeight: "29.7cm" }}>
            <div style={{ padding: "2.54cm" }} className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>

      {/* Zoom bar */}
      <div className="flex items-center justify-end gap-2 border-t bg-white px-4 py-1.5">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-2 w-24 rounded-full" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  );
}
