'use client';

import { useState, useCallback } from 'react';

/**
 * Reusable hook for child-table edit state in ERPFormClient.
 * Tracks per-fieldname child row arrays and provides helpers for
 * add / delete / cell-change operations.
 */
export interface UseEditChildTablesReturn {
  editChildTables: Record<string, Record<string, unknown>[]>;
  setEditChildTables: React.Dispatch<React.SetStateAction<Record<string, Record<string, unknown>[]>>>;
  handleAddChildRow: (fieldname: string, childDoctype: string) => void;
  handleDeleteChildRow: (fieldname: string, rowName: string) => void;
  handleChildCellChange: (fieldname: string, rowName: string, colName: string, value: unknown) => void;
}

export function useEditChildTables(
  initialChildTables: Record<string, Record<string, unknown>[]>,
): UseEditChildTablesReturn {
  const [editChildTables, setEditChildTables] =
    useState<Record<string, Record<string, unknown>[]>>(initialChildTables);

  const handleAddChildRow = useCallback(
    (fieldname: string, _childDoctype: string) => {
      setEditChildTables((prev) => {
        const existing = prev[fieldname] ?? [];
        const newRow: Record<string, unknown> = {
          name: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          idx: existing.length + 1,
          __is_new: true,
        };
        return { ...prev, [fieldname]: [...existing, newRow] };
      });
    },
    [],
  );

  const handleDeleteChildRow = useCallback(
    (fieldname: string, rowName: string) => {
      setEditChildTables((prev) => {
        const existing = prev[fieldname] ?? [];
        const filtered = existing.filter((r) => r.name !== rowName);
        // Re-index after deletion
        const reindexed = filtered.map((r, i) => ({ ...r, idx: i + 1 }));
        return { ...prev, [fieldname]: reindexed };
      });
    },
    [],
  );

  const handleChildCellChange = useCallback(
    (fieldname: string, rowName: string, colName: string, value: unknown) => {
      setEditChildTables((prev) => {
        const existing = prev[fieldname] ?? [];
        const updated = existing.map((r) =>
          r.name === rowName ? { ...r, [colName]: value } : r,
        );
        return { ...prev, [fieldname]: updated };
      });
    },
    [],
  );

  return {
    editChildTables,
    setEditChildTables,
    handleAddChildRow,
    handleDeleteChildRow,
    handleChildCellChange,
  };
}
