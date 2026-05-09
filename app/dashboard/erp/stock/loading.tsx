import { Skeleton } from "@/components/ui/skeleton";

export default function StockDashboardSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-5 pb-6">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-3" />
            <Skeleton className="h-4 w-12" />
          </div>

          {/* Chart card skeleton */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-5 w-52 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>

          {/* 3 KPI cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>

          {/* Masters & Reports grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
