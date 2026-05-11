'use client';

import { type JSX, useCallback, useState } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GridRowActionsProps {
  rowName: string;
  rowIdx: number;
  editable: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDuplicate: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete: () => void;
}

/**
 * Per-row actions column: drag handle, expand toggle, overflow menu.
 * Wraps the sortable drag handle when editable.
 */
export function GridRowActions({
  rowName,
  rowIdx,
  editable,
  isExpanded,
  onToggleExpand,
  onDuplicate,
  onInsertAbove,
  onInsertBelow,
  onDelete,
}: GridRowActionsProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rowName, disabled: !editable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-0.5 px-1"
    >
      {/* Drag handle (editable only) */}
      {editable && (
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent text-muted-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        className="p-1 rounded hover:bg-accent text-muted-foreground"
        onClick={onToggleExpand}
        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
      >
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Overflow menu */}
      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onInsertAbove}>
              <ArrowUp className="mr-2 h-3.5 w-3.5" />
              Insert Above
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onInsertBelow}>
              <ArrowDown className="mr-2 h-3.5 w-3.5" />
              Insert Below
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * Wrapper that provides the SortableContext for the grid rows.
 */
export function GridSortableWrapper({
  rowIds,
  children,
}: {
  rowIds: string[];
  children: React.ReactNode;
}): JSX.Element {
  return (
    <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}
