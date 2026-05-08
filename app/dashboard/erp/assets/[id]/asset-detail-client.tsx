"use client";

import Link from "next/link";
import {
  ArrowLeft, Wrench, MapPin, DollarSign, Calendar,
  CheckCircle, Package, AlertTriangle, XCircle,
  Clock, ShieldCheck, WrenchIcon, User, FolderKanban,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  AVAILABLE: { label: "Available", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  IN_USE: { label: "In Use", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Package },
  UNDER_MAINTENANCE: { label: "Maintenance", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  CALIBRATION_DUE: { label: "Calibration Due", badge: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  DECOMMISSIONED: { label: "Decommissioned", badge: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(nextDate: string | null | undefined) {
  if (!nextDate) return false;
  return new Date(nextDate) < new Date();
}

function daysUntil(nextDate: string | null | undefined) {
  if (!nextDate) return null;
  const diff = new Date(nextDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface AssetRecord {
  id: string;
  asset_name: string;
  asset_code: string;
  asset_category: string;
  status: string;
  location: string | null;
  warehouse_id: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  current_value: number | null;
  depreciation_rate: number;
  calibration_date: string | null;
  next_calibration_date: string | null;
  calibration_certificate: string | null;
  certification_body: string | null;
  assigned_to_project: string | null;
  assigned_to_personnel: string | null;
  notes: string | null;
  warehouses: {
    id: string;
    warehouse_name: string;
    warehouse_code: string;
    location: string;
  } | null;
  personnel: {
    id: string;
    first_name: string;
    last_name: string;
    designation: string | null;
  } | null;
  projects: {
    id: string;
    project_name: string;
    project_code: string;
  } | null;
  maintenance_records: {
    id: string;
    maintenance_type: string;
    description: string;
    performed_by: string;
    performed_date: string;
    next_due_date: string | null;
    cost: number;
  }[];
}

export default function AssetDetailClient({ record }: { record: AssetRecord }) {
  const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.AVAILABLE;
  const StatusIcon = cfg.icon;
  const overdue = isOverdue(record.next_calibration_date);
  const daysToCal = daysUntil(record.next_calibration_date);

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Back */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/erp/assets"
              className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#1e3a5f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Assets
            </Link>
          </div>

          {/* Asset Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                    <Wrench size={20} className="text-[#1e3a5f]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#0f172a]">{record.asset_name}</h1>
                    <p className="text-sm font-mono text-[#64748b]">{record.asset_code}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>
                    <StatusIcon size={12} /> {cfg.label}
                  </span>
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200">
                    {record.asset_category}
                  </span>
                </div>
              </div>
              {record.purchase_cost != null && (
                <div className="text-right">
                  <p className="text-xs text-[#94a3b8] uppercase">Purchase Cost</p>
                  <p className="text-2xl font-bold text-[#0f172a]">AED {record.purchase_cost.toLocaleString()}</p>
                  {record.current_value != null && (
                    <p className="text-sm text-[#64748b]">
                      Current Value: AED {record.current_value.toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Key Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
              {record.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Location</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.location}</p>
                  </div>
                </div>
              )}
              {record.warehouses && (
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Warehouse</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.warehouses.warehouse_name}</p>
                  </div>
                </div>
              )}
              {record.purchase_date && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Purchase Date</p>
                    <p className="text-sm font-medium text-[#0f172a]">{formatDate(record.purchase_date)}</p>
                  </div>
                </div>
              )}
              {record.depreciation_rate > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Depreciation</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.depreciation_rate}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* Assignment Info */}
            {(record.personnel || record.projects) && (
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
                {record.personnel && (
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#64748b]" />
                    <div>
                      <p className="text-xs text-[#94a3b8] uppercase">Assigned To</p>
                      <Link href={`/dashboard/erp/hr/${record.personnel.id}`} className="text-sm font-medium text-[#0f172a] hover:text-[#1e3a5f] transition-colors">
                        {record.personnel.first_name} {record.personnel.last_name}
                      </Link>
                    </div>
                  </div>
                )}
                {record.projects && (
                  <div className="flex items-center gap-2">
                    <FolderKanban size={14} className="text-[#64748b]" />
                    <div>
                      <p className="text-xs text-[#94a3b8] uppercase">Project</p>
                      <Link href={`/dashboard/erp/projects/${record.projects.id}`} className="text-sm font-medium text-[#0f172a] hover:text-[#1e3a5f] transition-colors">
                        {record.projects.project_name}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {record.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-[#94a3b8] uppercase mb-1">Notes</p>
                <p className="text-sm text-[#64748b]">{record.notes}</p>
              </div>
            )}
          </div>

          {/* Calibration Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#1e3a5f]" />
              <h2 className="text-lg font-semibold text-[#0f172a]">Calibration</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase mb-1">Last Calibration</p>
                  <p className="text-sm font-medium text-[#0f172a]">{formatDate(record.calibration_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase mb-1">Next Calibration</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0f172a]">{formatDate(record.next_calibration_date)}</p>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        <AlertTriangle size={10} /> Overdue
                      </span>
                    )}
                    {!overdue && daysToCal !== null && daysToCal <= 30 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        <Clock size={10} /> {daysToCal} days
                      </span>
                    )}
                  </div>
                </div>
                {record.certification_body && (
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase mb-1">Certification Body</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.certification_body}</p>
                  </div>
                )}
              </div>
              {record.calibration_certificate && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-[#94a3b8] uppercase mb-1">Certificate</p>
                  <p className="text-sm text-[#64748b]">{record.calibration_certificate}</p>
                </div>
              )}
            </div>
          </div>

          {/* Maintenance History */}
          {record.maintenance_records.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <WrenchIcon size={18} className="text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-[#0f172a]">Maintenance History</h2>
                <span className="text-sm text-[#64748b]">({record.maintenance_records.length})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {record.maintenance_records.map((mr) => (
                  <div key={mr.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                            {mr.maintenance_type}
                          </span>
                          <span className="text-xs text-[#94a3b8]">{formatDate(mr.performed_date)}</span>
                        </div>
                        <p className="text-sm text-[#64748b] mt-1">{mr.description}</p>
                        <p className="text-xs text-[#94a3b8] mt-1">Performed by: {mr.performed_by}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-[#0f172a]">AED {mr.cost.toLocaleString()}</p>
                        {mr.next_due_date && (
                          <p className="text-xs text-[#94a3b8]">Next due: {formatDate(mr.next_due_date)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
