import { Skeleton } from "@/components/ui/skeleton";

export function BuyingDashboardSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Breadcrumb */}
          <Skeleton className="h-5 w-24" />

          {/* Chart Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-44" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </div>

          {/* 3 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>

          {/* Tabs skeleton */}
          <Skeleton className="h-10 w-full rounded-xl" />

          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
              >
                <Skeleton className="h-5 w-24 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-lg" />
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

export default function BuyingLoading() {
  return <BuyingDashboardSkeleton />;
}
