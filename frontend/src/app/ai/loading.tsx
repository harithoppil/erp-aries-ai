import { Skeleton } from "@/components/ui/skeleton";

export default function AILoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-4xl flex-col overflow-hidden">
      {/* Persona selector header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-2 w-28" />
            </div>
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 justify-start">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-16 w-3/5 rounded-2xl rounded-bl-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Input footer */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-12 rounded-xl" />
        </div>
        <Skeleton className="h-3 w-40 mt-1.5" />
      </div>
    </div>
  );
}
