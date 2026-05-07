import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-8 w-40" />
          </div>
          {/* Settings cards grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Appearance card */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </div>
            {/* API Auth card */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 w-14 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
            {/* Database card */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-28" /></div>
                <div className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>
                <div className="flex justify-between"><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-28" /></div>
              </div>
            </div>
            {/* Cloud services card */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-28" /></div>
                <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /></div>
                <div className="flex justify-between"><Skeleton className="h-4 w-14" /><Skeleton className="h-4 w-32" /></div>
                <div className="flex justify-between"><Skeleton className="h-4 w-10" /><Skeleton className="h-4 w-24" /></div>
              </div>
            </div>
            {/* Security card (full width) */}
            <div className="col-span-2 rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
