"use client";

import Link from "next/link";
import {
  ArrowLeft, Package, Warehouse, DollarSign, ShieldAlert,
  AlertTriangle, CheckCircle, ArrowRightLeft, Calendar,
  Hash, Box,
} from "lucide-react";

const ITEM_GROUP_COLORS: Record<string, string> = {
  CONSUMABLE: "bg-purple-100 text-purple-700 border-purple-200",
  EQUIPMENT: "bg-blue-100 text-blue-700 border-blue-200",
  SERVICE: "bg-teal-100 text-teal-700 border-teal-200",
  RAW_MATERIAL: "bg-amber-100 text-amber-700 border-amber-200",
  SPARE_PART: "bg-orange-100 text-orange-700 border-orange-200",
};

const ENTRY_TYPE_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  RECEIPT: { label: "Receipt", badge: "bg-green-100 text-green-700 border-green-200", icon: ArrowRightLeft },
  DELIVERY: { label: "Delivery", badge: "bg-red-100 text-red-700 border-red-200", icon: ArrowRightLeft },
  TRANSFER: { label: "Transfer", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: ArrowRightLeft },
  MANUFACTURE: { label: "Manufacture", badge: "bg-purple-100 text-purple-700 border-purple-200", icon: ArrowRightLeft },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface StockRecord {
  id: string;
  item_code: string;
  item_name: string;
  item_group: string;
  description: string | null;
  unit: string;
  has_batch: boolean;
  has_serial: boolean;
  valuation_method: string;
  standard_rate: number | null;
  min_order_qty: number | null;
  safety_stock: number | null;
  bins: {
    id: string;
    quantity: number;
    valuation_rate: number;
    stock_value: number;
    warehouses: {
      id: string;
      warehouse_name: string;
      warehouse_code: string;
      location: string;
    };
  }[];
  stock_entries: {
    id: string;
    entry_type: string;
    quantity: number;
    serial_number: string | null;
    batch_number: string | null;
    valuation_rate: number | null;
    reference: string | null;
    posting_date: string;
    warehouses_stock_entries_source_warehouseTowarehouses: {
      id: string;
      warehouse_name: string;
      warehouse_code: string;
    } | null;
    warehouses_stock_entries_target_warehouseTowarehouses: {
      id: string;
      warehouse_name: string;
      warehouse_code: string;
    } | null;
  }[];
}

export default function StockDetailClient({ record }: { record: StockRecord }) {
  const groupColor = ITEM_GROUP_COLORS[record.item_group] || "bg-gray-100 text-gray-700 border-gray-200";
  const totalQty = record.bins.reduce((sum, b) => sum + b.quantity, 0);
  const totalValue = record.bins.reduce((sum, b) => sum + b.stock_value, 0);
  const isBelowSafety = record.safety_stock != null && totalQty < record.safety_stock;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Back */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/erp/stock"
              className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#1e3a5f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Stock
            </Link>
          </div>

          {/* Item Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                    <Package size={20} className="text-[#1e3a5f]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#0f172a]">{record.item_name}</h1>
                    <p className="text-sm font-mono text-[#64748b]">{record.item_code}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${groupColor}`}>
                    {record.item_group}
                  </span>
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                    {record.unit}
                  </span>
                  {isBelowSafety && (
                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border bg-red-100 text-red-700 border-red-200">
                      <ShieldAlert size={12} /> Below Safety Stock
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#0f172a]">{totalQty}</p>
                <p className="text-sm text-[#64748b]">{record.unit} total</p>
                <p className="text-lg font-bold text-[#0f172a] mt-1">AED {totalValue.toLocaleString()}</p>
                <p className="text-xs text-[#94a3b8]">total value</p>
              </div>
            </div>

            {/* Item Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
              {record.standard_rate != null && (
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Standard Rate</p>
                    <p className="text-sm font-medium text-[#0f172a]">AED {record.standard_rate.toLocaleString()}</p>
                  </div>
                </div>
              )}
              {record.safety_stock != null && (
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className={isBelowSafety ? "text-red-500" : "text-[#64748b]"} />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Safety Stock</p>
                    <p className={`text-sm font-medium ${isBelowSafety ? "text-red-700" : "text-[#0f172a]"}`}>{record.safety_stock} {record.unit}</p>
                  </div>
                </div>
              )}
              {record.min_order_qty != null && (
                <div className="flex items-center gap-2">
                  <Box size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Min Order Qty</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.min_order_qty}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-[#64748b]" />
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase">Valuation</p>
                  <p className="text-sm font-medium text-[#0f172a]">{record.valuation_method?.replace(/_/g, " ")}</p>
                </div>
              </div>
            </div>

            {record.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-[#94a3b8] uppercase mb-1">Description</p>
                <p className="text-sm text-[#64748b]">{record.description}</p>
              </div>
            )}
          </div>

          {/* Stock Levels per Warehouse (Bins) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Warehouse size={18} className="text-[#1e3a5f]" />
              <h2 className="text-lg font-semibold text-[#0f172a]">Stock Levels</h2>
              <span className="text-sm text-[#64748b]">({record.bins.length} bins)</span>
            </div>
            {record.bins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <Warehouse size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No stock in any warehouse</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-700 font-semibold">Warehouse</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Location</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Quantity</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Valuation Rate</th>
                      <th className="text-right px-4 py-3 text-gray-700 font-semibold">Stock Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {record.bins.map((bin) => {
                      const isLow = record.safety_stock != null && bin.quantity < (record.safety_stock / record.bins.length);
                      return (
                        <tr key={bin.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3">
                            <p className="font-medium text-[#0f172a]">{bin.warehouses.warehouse_name}</p>
                            <p className="text-xs text-[#94a3b8]">{bin.warehouses.warehouse_code}</p>
                          </td>
                          <td className="px-4 py-3 text-[#64748b]">{bin.warehouses.location}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${isLow ? "text-red-700" : "text-[#0f172a]"}`}>
                              {bin.quantity} {record.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[#64748b]">
                            AED {bin.valuation_rate.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#0f172a]">
                            AED {bin.stock_value.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Stock Entries */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-[#1e3a5f]" />
              <h2 className="text-lg font-semibold text-[#0f172a]">Recent Stock Movements</h2>
              <span className="text-sm text-[#64748b]">({record.stock_entries.length})</span>
            </div>
            {record.stock_entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <ArrowRightLeft size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No stock movements recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {record.stock_entries.map((entry) => {
                  const eCfg = ENTRY_TYPE_CONFIG[entry.entry_type] || ENTRY_TYPE_CONFIG.RECEIPT;
                  const EntryIcon = eCfg.icon;
                  const source = entry.warehouses_stock_entries_source_warehouseTowarehouses;
                  const target = entry.warehouses_stock_entries_target_warehouseTowarehouses;
                  return (
                    <div key={entry.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${eCfg.badge}`}>
                              <EntryIcon size={10} /> {eCfg.label}
                            </span>
                            <span className="text-xs text-[#94a3b8]">{formatDate(entry.posting_date)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#94a3b8]">
                            {source && (
                              <span>From: {source.warehouse_name}</span>
                            )}
                            {target && (
                              <span>To: {target.warehouse_name}</span>
                            )}
                            {entry.serial_number && <span>SN: {entry.serial_number}</span>}
                            {entry.batch_number && <span>Batch: {entry.batch_number}</span>}
                            {entry.reference && <span>Ref: {entry.reference}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${entry.entry_type === "RECEIPT" ? "text-green-700" : entry.entry_type === "DELIVERY" ? "text-red-700" : "text-[#0f172a]"}`}>
                            {entry.entry_type === "RECEIPT" ? "+" : entry.entry_type === "DELIVERY" ? "-" : ""}
                            {entry.quantity} {record.unit}
                          </p>
                          {entry.valuation_rate != null && (
                            <p className="text-xs text-[#94a3b8]">@ AED {entry.valuation_rate.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
