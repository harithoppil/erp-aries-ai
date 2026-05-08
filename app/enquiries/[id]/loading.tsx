import { Skeleton } from "@/components/ui/skeleton";

export default function EnquiryDetailLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Back button */}
          <Skeleton className="h-10 w-10 rounded-lg" />
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-8 w-56 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-36 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
          {/* Two-column cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
