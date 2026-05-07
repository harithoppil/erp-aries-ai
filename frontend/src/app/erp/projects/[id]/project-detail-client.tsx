"use client";

import Link from "next/link";
import {
  ArrowLeft, FolderKanban, MapPin, DollarSign, Calendar,
  Ship, CheckCircle, Clock, PauseCircle, ListTodo,
  User, AlertTriangle, XCircle, CheckSquare, Users,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  ACTIVE: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  PLANNING: { label: "Planning", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  COMPLETED: { label: "Completed", badge: "bg-gray-100 text-gray-700 border-gray-200", icon: CheckSquare },
  ON_HOLD: { label: "On Hold", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: PauseCircle },
  CANCELLED: { label: "Cancelled", badge: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  TODO: { label: "To Do", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  IN_PROGRESS: { label: "In Progress", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  REVIEW: { label: "Review", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  DONE: { label: "Done", badge: "bg-green-100 text-green-700 border-green-200" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface ProjectRecord {
  id: string;
  project_name: string;
  project_code: string;
  project_type: string;
  status: string;
  customer_name: string;
  expected_start: string | null;
  expected_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  project_location: string | null;
  vessel_name: string | null;
  estimated_cost: number | null;
  actual_cost: number;
  day_rate: number | null;
  currency: string;
  notes: string | null;
  tasks: {
    id: string;
    subject: string;
    description: string | null;
    status: string;
    assigned_to: string | null;
    start_date: string | null;
    end_date: string | null;
    progress: number;
  }[];
  project_assignments: {
    id: string;
    role: string;
    compliance_checked: boolean;
    compliance_passed: boolean;
    compliance_issues: string | null;
    personnel: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      designation: string | null;
      status: string;
      certifications: {
        id: string;
        cert_type: string;
        status: string;
        expiry_date: string | null;
      }[];
    };
  }[];
  enquiries: {
    id: string;
    enquiry_number: string | null;
    client_name: string;
    status: string;
  } | null;
}

export default function ProjectDetailClient({ record }: { record: ProjectRecord }) {
  const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.PLANNING;
  const StatusIcon = cfg.icon;

  const totalTasks = record.tasks.length;
  const completedTasks = record.tasks.filter((t) => t.status === "DONE").length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Back + Title */}
          <div className="flex items-center gap-4">
            <Link
              href="/erp/projects"
              className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#1e3a5f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Projects
            </Link>
          </div>

          {/* Project Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                    <FolderKanban size={20} className="text-[#1e3a5f]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#0f172a]">{record.project_name}</h1>
                    <p className="text-sm font-mono text-[#64748b]">{record.project_code}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>
                    <StatusIcon size={12} /> {cfg.label}
                  </span>
                  {record.project_type && (
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200">
                      {record.project_type}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                {record.estimated_cost != null && (
                  <p className="text-2xl font-bold text-[#0f172a]">
                    AED {record.estimated_cost.toLocaleString()}
                  </p>
                )}
                {record.day_rate != null && (
                  <p className="text-sm text-[#64748b]">Day Rate: AED {record.day_rate.toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Key Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[#64748b]" />
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase">Customer</p>
                  <p className="text-sm font-medium text-[#0f172a]">{record.customer_name}</p>
                </div>
              </div>
              {record.vessel_name && (
                <div className="flex items-center gap-2">
                  <Ship size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Vessel</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.vessel_name}</p>
                  </div>
                </div>
              )}
              {record.project_location && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#64748b]" />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase">Location</p>
                    <p className="text-sm font-medium text-[#0f172a]">{record.project_location}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#64748b]" />
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase">Duration</p>
                  <p className="text-sm font-medium text-[#0f172a]">
                    {formatDate(record.expected_start)} — {formatDate(record.expected_end)}
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#64748b]">Overall Progress</span>
                <span className="text-sm font-bold text-[#0f172a]">{overallProgress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0ea5e9] rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>

            {record.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-[#94a3b8] uppercase mb-1">Notes</p>
                <p className="text-sm text-[#64748b]">{record.notes}</p>
              </div>
            )}
          </div>

          {/* Tasks List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo size={18} className="text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-[#0f172a]">Tasks</h2>
                <span className="text-sm text-[#64748b]">({totalTasks})</span>
              </div>
              <div className="text-sm text-[#64748b]">
                {completedTasks}/{totalTasks} completed
              </div>
            </div>
            {record.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <ListTodo size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No tasks yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {record.tasks.map((task) => {
                  const tCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.TODO;
                  return (
                    <div key={task.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0f172a]">{task.subject}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${tCfg.badge}`}>
                              {tCfg.label}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-[#64748b] mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-[#94a3b8]">
                            {task.assigned_to && (
                              <span className="flex items-center gap-1"><User size={10} /> {task.assigned_to}</span>
                            )}
                            {task.start_date && (
                              <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(task.start_date)}</span>
                            )}
                          </div>
                        </div>
                        <div className="w-24 shrink-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-[#94a3b8]">Progress</span>
                            <span className="text-[10px] font-medium text-[#64748b]">{task.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#0ea5e9] rounded-full" style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assigned Personnel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Users size={18} className="text-[#1e3a5f]" />
              <h2 className="text-lg font-semibold text-[#0f172a]">Assigned Personnel</h2>
              <span className="text-sm text-[#64748b]">({record.project_assignments.length})</span>
            </div>
            {record.project_assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <Users size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No personnel assigned</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                {record.project_assignments.map((pa) => {
                  const fullName = `${pa.personnel.first_name} ${pa.personnel.last_name}`.trim();
                  const initials = `${pa.personnel.first_name?.[0] || ""}${pa.personnel.last_name?.[0] || ""}`.toUpperCase();
                  const expiredCerts = pa.personnel.certifications.filter((c) => c.status === "EXPIRED");
                  const expiringCerts = pa.personnel.certifications.filter((c) => c.status === "EXPIRING_SOON");
                  return (
                    <div key={pa.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xs font-bold text-[#1e3a5f]">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/erp/hr/${pa.personnel.id}`} className="font-medium text-[#0f172a] hover:text-[#1e3a5f] transition-colors">
                            {fullName}
                          </Link>
                          <p className="text-xs text-[#94a3b8]">{pa.personnel.designation || "—"}</p>
                        </div>
                        <span className="text-xs font-medium text-[#64748b] bg-gray-50 px-2 py-1 rounded-lg">{pa.role}</span>
                      </div>
                      {/* Compliance Status */}
                      <div className="flex items-center gap-2 mb-2">
                        {pa.compliance_checked ? (
                          pa.compliance_passed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                              <CheckCircle size={10} /> Compliant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                              <AlertTriangle size={10} /> Non-Compliant
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            <Clock size={10} /> Pending Check
                          </span>
                        )}
                      </div>
                      {pa.compliance_issues && (
                        <p className="text-xs text-red-600 mb-2">{pa.compliance_issues}</p>
                      )}
                      {/* Cert Warnings */}
                      {(expiredCerts.length > 0 || expiringCerts.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {expiredCerts.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                              <XCircle size={8} /> {c.cert_type} Expired
                            </span>
                          ))}
                          {expiringCerts.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                              <AlertTriangle size={8} /> {c.cert_type} Expiring
                            </span>
                          ))}
                        </div>
                      )}
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
