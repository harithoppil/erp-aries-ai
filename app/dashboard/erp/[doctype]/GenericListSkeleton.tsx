import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

// ── Desktop Table Skeleton ──────────────────────────────────────────────────

function DesktopSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header area */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 6 }).map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton
                      className="h-4"
                      style={{
                        width: `${50 + Math.floor(((rowIdx * 6 + colIdx) * 17) % 80)}px`,
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Mobile Card Skeleton ────────────────────────────────────────────────────

function MobileSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* Cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-gray-100">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Combined Skeleton ───────────────────────────────────────────────────────

export default function GenericListSkeleton() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <DesktopSkeleton />
      </div>
      {/* Mobile */}
      <div className="block md:hidden">
        <MobileSkeleton />
      </div>
    </>
  );
}
