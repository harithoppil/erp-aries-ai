import { Skeleton } from '@/components/ui/skeleton';

function SellingDashboardSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Chart card skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-[260px] w-full rounded-xl" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div>
                  <Skeleton className="h-3 w-24 mb-1" />
                  <Skeleton className="h-7 w-20" />
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Reports & Masters grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <Skeleton className="h-5 w-28 mb-4" />
              <div className="space-y-3">
                {Array(4)
                  .fill(0)
                  .map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function renderSkeletons() {
  return <SellingDashboardSkeleton />;
}

export default function SellingLoading() {
  return renderSkeletons();
}
