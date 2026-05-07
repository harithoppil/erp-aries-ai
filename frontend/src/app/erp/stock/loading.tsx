import { Skeleton } from "@/components/ui/skeleton";

export default function StockLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-4 pb-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-44 mb-2" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
          {/* Search */}
          <Skeleton className="h-10 w-full rounded-xl" />
          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          {/* Stat cards - 3 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>
          {/* Tab switcher pills */}
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          {/* Table - 5 cols */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Item','Code','Category','Unit','Quantity'].map(h => (
                    <th key={h} className="text-left px-4 py-3"><Skeleton className="h-4 w-14" /></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array(4).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
