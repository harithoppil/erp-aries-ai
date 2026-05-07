import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div>
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          {/* Upload panel area */}
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
