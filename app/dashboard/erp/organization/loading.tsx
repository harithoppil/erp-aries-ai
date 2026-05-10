import { Skeleton } from '@/components/ui/skeleton';

function OrganizationDashboardSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Onboarding card skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full mb-5" />
        <div className="space-y-3">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <Skeleton className="h-[18px] w-[18px] rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
        </div>
      </div>

      {/* Masters grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <Skeleton className="h-5 w-24 mb-4" />
              <div className="space-y-3">
                {Array(i === 1 ? 3 : i === 3 ? 1 : 2)
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
  return <OrganizationDashboardSkeleton />;
}

export default function OrganizationLoading() {
  return renderSkeletons();
}
