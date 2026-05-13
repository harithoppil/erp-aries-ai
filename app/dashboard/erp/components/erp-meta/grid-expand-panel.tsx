'use client';

import { type JSX } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ERPTabLayout } from '@/app/dashboard/erp/components/erp-meta/ERPTabLayout';
import type { DocTypeMeta } from '@/lib/erpnext/doctype-meta';

interface GridExpandPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childMeta: DocTypeMeta;
  row: Record<string, unknown>;
  rowIdx: number;
  editable: boolean;
  onFieldChange: (fieldname: string, value: unknown) => void;
}

/**
 * Side panel (Sheet) that opens when a user expands a grid row.
 * Shows ALL fields of the child DocType using ERPTabLayout,
 * so the user can edit fields that don't fit horizontally in the grid.
 */
export function GridExpandPanel({
  open,
  onOpenChange,
  childMeta,
  row,
  rowIdx,
  editable,
  onFieldChange,
}: GridExpandPanelProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Row {rowIdx + 1}
          </SheetTitle>
          <SheetDescription>
            Edit all fields for this {childMeta.doctype} row.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ERPTabLayout
            tree={childMeta.layout_tree}
            record={row}
            editable={editable}
            errors={{}}
            onFieldChange={onFieldChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
