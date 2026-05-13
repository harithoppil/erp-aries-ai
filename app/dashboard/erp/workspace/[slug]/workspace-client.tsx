'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import * as LucideIcons from 'lucide-react';
import {
  fetchWorkspace,
  type WorkspaceShortcut,
  type WorkspaceData,
  type FetchWorkspaceResult,
} from '@/app/dashboard/erp/workspace-actions';

interface WorkspaceClientProps {
  slug: string;
}

function resolveIcon(iconName: string): JSX.Element {
  const pascal = iconName
    .split(/[-_\s]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  const Icon = (LucideIcons as Record<string, unknown>)[pascal];
  if (typeof Icon === 'function') {
    const Comp = Icon as React.ComponentType<{ className?: string }>;
    return <Comp className="h-6 w-6" />;
  }
  return <LucideIcons.FileText className="h-6 w-6" />;
}

const CARD_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
];

function WorkspaceSkeleton({ isMobile }: { isMobile: boolean }): JSX.Element {
  const cols = isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className={`grid ${cols} gap-4`}>
        {Array(6).fill(0).map((_, i) => (
          <Card key={i} className="border">
            <CardContent className="p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceClient({ slug }: WorkspaceClientProps): JSX.Element {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWorkspace(slug).then((result: FetchWorkspaceResult) => {
      if (cancelled) return;
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <WorkspaceSkeleton isMobile={isMobile} />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <LucideIcons.AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <></>;

  const gridCols = isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{data.label}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.shortcuts.length} DocTypes • {data.shortcuts.reduce((s, sc) => s + sc.count, 0)} total records
        </p>
      </div>

      <div className={`grid ${gridCols} gap-4`}>
        {data.shortcuts.map((shortcut, i) => (
          <Card
            key={shortcut.doctype}
            className={`cursor-pointer hover:shadow-md transition-shadow border ${CARD_COLORS[i % CARD_COLORS.length]}`}
            onClick={() => router.push(shortcut.href)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="shrink-0">{resolveIcon(shortcut.icon)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{shortcut.label}</p>
                <p className="text-xs opacity-70">{shortcut.count} record{shortcut.count !== 1 ? 's' : ''}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
