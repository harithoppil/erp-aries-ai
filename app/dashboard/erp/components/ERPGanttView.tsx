'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import Gantt from 'frappe-gantt';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { GanttChart, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import {
  fetchGanttData,
  type GanttConfig,
  type GanttTask,
  type FetchGanttResult,
} from '@/app/dashboard/erp/gantt-actions';

interface ERPGanttViewProps {
  doctype: string;
}

type ZoomMode = 'Day' | 'Half Day' | 'Week' | 'Month';

function GanttSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-full rounded" style={{ width: `${40 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ERPGanttView({ doctype }: ERPGanttViewProps): JSX.Element {
  const [config, setConfig] = useState<GanttConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('Week');
  const ganttRef = useRef<Gantt | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  const loadGantt = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result: FetchGanttResult = await fetchGanttData(doctype);
    if (result.success) {
      setConfig(result.config);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [doctype]);

  useEffect(() => {
    loadGantt();
  }, [loadGantt]);

  // Render Gantt chart when config or zoom changes
  useEffect(() => {
    if (!config || !svgRef.current || config.tasks.length === 0) return;

    // Clean up previous instance
    if (ganttRef.current) {
      ganttRef.current = null;
    }

    const tasks = config.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress,
      dependencies: t.dependencies || '',
      custom_class: `gantt-bar-${t.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
    }));

    try {
      ganttRef.current = new Gantt(svgRef.current, tasks, {
        view_mode: zoomMode,
        date_format: 'YYYY-MM-DD',
        on_click: (task: { id: string }) => {
          const matchedTask = config.tasks.find((t) => t.id === task.id);
          if (matchedTask) {
            router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(matchedTask.id)}`);
          }
        },
        on_date_change: (_task: unknown, _start: Date, _end: Date) => {
          // Could persist date changes via server action
          // For now, just visual feedback
        },
        on_progress_change: (_task: unknown, _progress: number) => {
          // Could persist progress changes
        },
        custom_popup_html: (task: { id: string; name: string; start: string; end: string; progress: number }) => {
          const matchedTask = config.tasks.find((t) => t.id === task.id);
          const color = matchedTask?.color ?? '#3b82f6';
          return `
            <div style="padding: 8px 12px; font-size: 12px; min-width: 160px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${task.name}</div>
              <div style="color: #666;">${task.start} → ${task.end}</div>
              <div style="color: ${color}; margin-top: 4px;">Progress: ${task.progress}%</div>
            </div>
          `;
        },
      });
    } catch (err: unknown) {
      console.error('[Gantt render]', err instanceof Error ? err.message : String(err));
    }

    return () => {
      ganttRef.current = null;
    };
  }, [config, zoomMode, doctype, router]);

  const handleZoomChange = useCallback((mode: ZoomMode) => {
    setZoomMode(mode);
    if (ganttRef.current) {
      ganttRef.current.change_view_mode(mode.toLowerCase().replace(' ', '_'));
    }
  }, []);

  if (loading) {
    return <GanttSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <GanttChart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!config || config.tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <GanttChart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No tasks with date ranges found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GanttChart className="h-4 w-4" />
          Gantt — {config.doctypeLabel}
        </h3>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px]">{config.startField} → {config.endField}</Badge>
          <Badge variant="secondary" className="text-[10px]">{config.tasks.length} tasks</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>
              {config.progressField ? `${config.titleField} with progress` : `${config.titleField} timeline`}
            </CardDescription>
            <div className="flex items-center gap-1">
              {(['Day', 'Week', 'Month'] as ZoomMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={zoomMode === mode ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleZoomChange(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={svgRef}
            className="overflow-x-auto"
            style={{ minHeight: isMobile ? '300px' : '400px' }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
