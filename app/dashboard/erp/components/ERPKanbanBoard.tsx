'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { GripVertical, Plus, LayoutGrid } from 'lucide-react';
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

// ── Sortable Card ────────────────────────────────────────────────────────────

function SortableKanbanCard({ card, doctype }: {
  card: KanbanCard;
  doctype: string;
}): JSX.Element {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.name, data: { card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(card.name)}`)}
    >
      <div className="flex items-start gap-2">
        <button
          className="cursor-grab active:cursor-grabbing mt-0.5"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{card.title || card.name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{card.name}</p>
        </div>
      </div>
    </div>
  );
}

// ── Drag Overlay Card ────────────────────────────────────────────────────────

function DragOverlayCard({ card }: { card: KanbanCard }): JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl rotate-2">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{card.title || card.name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{card.name}</p>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Column ─────────────────────────────────────────────────────────

function KanbanColumnDroppable({ col, cards, doctype, onQuickAdd }: {
  col: KanbanColumn;
  cards: KanbanCard[];
  doctype: string;
  onQuickAdd: (columnValue: string) => void;
}): JSX.Element {
  const { setNodeRef, isOver } = useSortable({ id: col.value, data: { type: 'column' } });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 min-h-[200px] transition-colors ${
        col.color
      } ${isOver ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold">{col.label}</h4>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px]">{cards.length}</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={(e) => { e.stopPropagation(); onQuickAdd(col.value); }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <SortableContext items={cards.map((c) => c.name)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {cards.map((card) => (
            <SortableKanbanCard key={card.name} card={card} doctype={doctype} />
          ))}
          {cards.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Drop cards here</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ERPKanbanBoard({ doctype }: ERPKanbanBoardProps): JSX.Element {
  const [config, setConfig] = useState<KanbanConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  // Track local card positions for optimistic updates
  const [localCards, setLocalCards] = useState<KanbanCard[]>([]);
  useEffect(() => {
    if (config) setLocalCards(config.cards);
  }, [config]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = localCards.find((c) => c.name === event.active.id);
    if (card) setActiveCard(card);
  }, [localCards]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Find which column the card is being dragged over
    const overColumn = config?.columns.find((c) => c.value === overId);
    const overCard = localCards.find((c) => c.name === overId);

    let targetColumn: string | null = null;
    if (overColumn) {
      targetColumn = overColumn.value;
    } else if (overCard) {
      targetColumn = overCard.columnValue;
    }

    if (!targetColumn) return;

    // Optimistically move the card to the target column
    setLocalCards((prev) => {
      const activeCard = prev.find((c) => c.name === activeId);
      if (!activeCard || activeCard.columnValue === targetColumn) return prev;
      return prev.map((c) =>
        c.name === activeId ? { ...c, columnValue: targetColumn } : c,
      );
    });
  }, [config, localCards]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active } = event;
    setActiveCard(null);

    if (!config) return;

    const activeId = String(active.id);
    const card = localCards.find((c) => c.name === activeId);
    if (!card) return;

    // Check if the card actually moved to a different column
    const originalCard = config.cards.find((c) => c.name === activeId);
    if (!originalCard || originalCard.columnValue === card.columnValue) return;

    // Persist the move
    const result = await updateKanbanCardField(doctype, card.name, config.fieldname, card.columnValue);
    if (result.success) {
      toast.success(`Moved to ${card.columnValue}`);
    } else {
      toast.error(result.error || 'Failed to move card');
      // Revert optimistic update
      setLocalCards(config.cards);
    }
  }, [config, doctype, localCards]);

  const handleQuickAdd = useCallback((columnValue: string) => {
    if (!config) return;
    router.push(`/dashboard/erp/${doctype}/new?${config.fieldname}=${encodeURIComponent(columnValue)}`);
  }, [config, doctype, router]);

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
  const visibleColumns = config.columns.slice(0, colsPerView);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Kanban — {config.doctypeLabel}
        </h3>
        <Badge variant="outline" className="text-[10px]">{config.fieldname}</Badge>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colsPerView}, minmax(0, 1fr))` }}>
          {visibleColumns.map((col) => {
            const colCards = localCards.filter((c) => c.columnValue === col.value);
            return (
              <KanbanColumnDroppable
                key={col.value}
                col={col}
                cards={colCards}
                doctype={doctype}
                onQuickAdd={handleQuickAdd}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeCard ? <DragOverlayCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {config.columns.length > colsPerView && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {colsPerView} of {config.columns.length} columns
        </p>
      )}
    </div>
  );
}
