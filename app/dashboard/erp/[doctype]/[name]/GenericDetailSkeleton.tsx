'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Skeleton component that mirrors the exact layout of GenericDetailClient.
 * Pattern 2: dedicated skeleton = zero layout shift on load.
 */
export default function GenericDetailSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── Sticky top bar skeleton ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div>
              <Skeleton className="h-6 w-48 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* ── Field cards skeleton (3-col grid) ── */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(9)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Child table skeleton ── */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-5 w-24" />
                ))}
            </div>
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex gap-4">
                  {Array(5)
                    .fill(0)
                    .map((_, j) => (
                      <Skeleton key={j} className="h-5 w-24" />
                    ))}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom tabs skeleton ── */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
