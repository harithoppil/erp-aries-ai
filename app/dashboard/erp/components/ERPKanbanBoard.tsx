'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { GripVertical, ArrowRight, Loader2, LayoutGrid } from 'lucide-react';
import {
  fetchKanbanData,
  updateKanbanCardField,
  type KanbanColumn,
  type KanbanCard,
  type KanbanConfig,
  type FetchKanbanResult,
} from '@/app/dashboard/erp/kanban-actions';

interface ERPKanbanBoardProps {
  doctype: string;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function KanbanSkeleton({ isMobile }: { isMobile: boolean }): JSX.Element {
  const cols = isMobile ? 2 : 4;
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array(cols).fill(0).map((_, ci) => (
        <div key={ci} className="space-y-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          {Array(3).fill(0).map((_, ri) => (
            <Skeleton key={ri} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

function KanbanCardComponent({ card, doctype, onMove }: {
  card: KanbanCard;
  doctype: string;
  onMove: (card: KanbanCard, direction: 'left' | 'right') => void;
}): JSX.Element {
  const router = useRouter();
  const [moving, setMoving] = useState(false);

  const handleMove = useCallback(async (direction: 'left' | 'right') => {
    setMoving(true);
    await onMove(card, direction);
    setMoving(false);
  }, [card, onMove]);

  return (
    <div
      className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(card.name)}`)}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{card.title || card.name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{card.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          onClick={(e) => { e.stopPropagation(); handleMove('left'); }}
          disabled={moving}
        >
          {moving ? <Loader2 className="h-3 w-3 animate-spin" /> : '←'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          onClick={(e) => { e.stopPropagation(); handleMove('right'); }}
          disabled={moving}
        >
          {moving ? <Loader2 className="h-3 w-3 animate-spin" /> : '→'}
        </Button>
      </div>
    </div>
  );
}

export function ERPKanbanBoard({ doctype }: ERPKanbanBoardProps): JSX.Element {
  const [config, setConfig] = useState<KanbanConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const loadKanban = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result: FetchKanbanResult = await fetchKanbanData(doctype);
    if (result.success) {
      setConfig(result.config);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [doctype]);

  useEffect(() => {
    loadKanban();
  }, [loadKanban]);

  const handleMoveCard = useCallback(async (card: KanbanCard, direction: 'left' | 'right') => {
    if (!config) return;
    const colIdx = config.columns.findIndex((c) => c.value === card.columnValue);
    if (colIdx < 0) return;

    const newIdx = direction === 'left' ? colIdx - 1 : colIdx + 1;
    if (newIdx < 0 || newIdx >= config.columns.length) return;

    const newColumn = config.columns[newIdx];
    const result = await updateKanbanCardField(doctype, card.name, config.fieldname, newColumn.value);
    if (result.success) {
      toast.success(`Moved to ${newColumn.label}`);
      await loadKanban();
    } else {
      toast.error(result.error || 'Failed to move card');
    }
  }, [config, doctype, loadKanban]);

  if (loading) {
    return <KanbanSkeleton isMobile={isMobile} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <LayoutGrid className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!config) return <></>;

  const colsPerView = isMobile ? 2 : Math.min(config.columns.length, 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Kanban — {config.doctypeLabel}
        </h3>
        <Badge variant="outline" className="text-[10px]">{config.fieldname}</Badge>
      </div>

      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${colsPerView}, minmax(0, 1fr))` }}>
        {config.columns.slice(0, colsPerView).map((col) => {
          const colCards = config.cards.filter((c) => c.columnValue === col.value);
          return (
            <div key={col.value} className={`rounded-lg border p-3 ${col.color} min-h-[200px]`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold">{col.label}</h4>
                <Badge variant="secondary" className="text-[10px]">{colCards.length}</Badge>
              </div>
              <div className="space-y-2">
                {colCards.map((card) => (
                  <KanbanCardComponent
                    key={card.name}
                    card={card}
                    doctype={doctype}
                    onMove={handleMoveCard}
                  />
                ))}
                {colCards.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {config.columns.length > colsPerView && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {colsPerView} of {config.columns.length} columns
        </p>
      )}
    </div>
  );
}
