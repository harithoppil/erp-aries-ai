"use client";

import { type LucideIcon, Inbox } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T & string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Responsive data table with empty state. Replaces the repeated table pattern
 * across all ERP pages. Desktop shows a table, mobile could show cards.
 */
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = "id",
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = "No data found",
  emptyDescription = "Try adjusting your filters or search.",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8]">
          <EmptyIcon size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">{emptyTitle}</p>
          <p className="text-sm">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={String(row[keyField] ?? idx)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? "—")}
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
