"use client";

import Link from "next/link";
import {
  ArrowLeft, Users, CheckCircle, AlertTriangle, XCircle,
  Mail, Phone, DollarSign, Calendar, ShieldCheck,
  FolderKanban, Clock, User, Ban,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  ACTIVE: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  ON_PROJECT: { label: "On Project", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: FolderKanban },
  ON_LEAVE: { label: "On Leave", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  INACTIVE: { label: "Inactive", badge: "bg-gray-100 text-gray-700 border-gray-200", icon: Ban },
};

const CERT_STATUS: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  VALID: { label: "Valid", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  EXPIRING_SOON: { label: "Expiring Soon", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  EXPIRED: { label: "Expired", badge: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  SUSPENDED: { label: "Suspended", badge: "bg-gray-100 text-gray-600 border-gray-300", icon: Ban },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface PersonnelRecord {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  designation: string | null;
  department: string | null;
  day_rate: number | null;
  currency: string;
  certifications: {
    id: string;
    cert_type: string;
    cert_number: string | null;
    issuing_body: string | null;
    issue_date: string | null;
    expiry_date: string | null;
    status: string;
  }[];
  project_assignments: {
    id: string;
    role: string;
    compliance_checked: boolean;
    compliance_passed: boolean;
    projects: {
      id: string;
      project_name: string;
      project_code: string;
      status: string;
    };
  }[];
}

export default function PersonnelDetailClient({ record }: { record: PersonnelRecord }) {
  const fullName = `${record.first_name} ${record.last_name}`.trim();
  const initials = `${record.first_name?.[0] || ""}${record.last_name?.[0] || ""}`.toUpperCase();
  const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.ACTIVE;
  const StatusIcon = cfg.icon;

  const validCerts = record.certifications.filter((c) => c.status === "VALID").length;
  const expiredCerts = record.certifications.filter((c) => c.status === "EXPIRED").length;
  const expiringCerts = record.certifications.filter((c) => c.status === "EXPIRING_SOON").length;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      <div className="flex-1 min-h-0 overflow-auto pr-2">
        <div className="space-y-6 pb-4">
          {/* Back */}
          <div className="flex items-center gap-4">
            <Link
              href="/erp/hr"
              className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#1e3a5f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Personnel
            </Link>
          </div>

          {/* Employee Profile */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xl font-bold text-[#1e3a5f] shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-[#0f172a]">{fullName}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${cfg.badge}`}>
                    <StatusIcon size={12} /> {cfg.label}
                  </span>
                </div>
                <p className="text-sm font-mono text-[#64748b] mb-4">ID: {record.employee_id}</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {record.designation && (
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-[#64748b]" />
                      <div>
                        <p className="text-xs text-[#94a3b8] uppercase">Designation</p>
                        <p className="text-sm font-medium text-[#0f172a]">{record.designation}</p>
                      </div>
                    </div>
                  )}
                  {record.department && (
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-[#64748b]" />
                      <div>
                        <p className="text-xs text-[#94a3b8] uppercase">Department</p>
                        <p className="text-sm font-medium text-[#0f172a]">{record.department}</p>
                      </div>
                    </div>
                  )}
                  {record.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-[#64748b]" />
                      <div>
                        <p className="text-xs text-[#94a3b8] uppercase">Email</p>
                        <p className="text-sm font-medium text-[#0f172a]">{record.email}</p>
                      </div>
                    </div>
                  )}
                  {record.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-[#64748b]" />
                      <div>
                        <p className="text-xs text-[#94a3b8] uppercase">Phone</p>
                        <p className="text-sm font-medium text-[#0f172a]">{record.phone}</p>
                      </div>
                    </div>
                  )}
                  {record.day_rate != null && (
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-[#64748b]" />
                      <div>
                        <p className="text-xs text-[#94a3b8] uppercase">Day Rate</p>
                        <p className="text-sm font-medium text-[#0f172a]">AED {record.day_rate.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-[#0f172a]">Certifications</h2>
                <span className="text-sm text-[#64748b]">({record.certifications.length})</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {validCerts > 0 && (
                  <span className="flex items-center gap-1 text-green-700"><CheckCircle size={12} /> {validCerts} valid</span>
                )}
                {expiringCerts > 0 && (
                  <span className="flex items-center gap-1 text-amber-700"><Clock size={12} /> {expiringCerts} expiring</span>
                )}
                {expiredCerts > 0 && (
                  <span className="flex items-center gap-1 text-red-700"><XCircle size={12} /> {expiredCerts} expired</span>
                )}
              </div>
            </div>
            {record.certifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <ShieldCheck size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No certifications on record</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {record.certifications.map((cert) => {
                  const cCfg = CERT_STATUS[cert.status] || CERT_STATUS.VALID;
                  const CertIcon = cCfg.icon;
                  return (
                    <div key={cert.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0f172a]">{cert.cert_type}</p>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${cCfg.badge}`}>
                              <CertIcon size={10} /> {cCfg.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#94a3b8]">
                            {cert.cert_number && <span>Cert#: {cert.cert_number}</span>}
                            {cert.issuing_body && <span>Issued by: {cert.issuing_body}</span>}
                            {cert.issue_date && <span>Issued: {formatDate(cert.issue_date)}</span>}
                            {cert.expiry_date && <span>Expires: {formatDate(cert.expiry_date)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Project Assignments History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <FolderKanban size={18} className="text-[#1e3a5f]" />
              <h2 className="text-lg font-semibold text-[#0f172a]">Project Assignments</h2>
              <span className="text-sm text-[#64748b]">({record.project_assignments.length})</span>
            </div>
            {record.project_assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <FolderKanban size={36} className="mb-3 opacity-40" />
                <p className="text-sm">No project assignments yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {record.project_assignments.map((pa) => {
                  const projStatusCfg: Record<string, string> = {
                    ACTIVE: "bg-green-100 text-green-700 border-green-200",
                    PLANNING: "bg-blue-100 text-blue-700 border-blue-200",
                    COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
                    ON_HOLD: "bg-amber-100 text-amber-700 border-amber-200",
                    CANCELLED: "bg-red-100 text-red-700 border-red-200",
                  };
                  return (
                    <div key={pa.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <Link
                            href={`/erp/projects/${pa.projects.id}`}
                            className="font-medium text-[#0f172a] hover:text-[#1e3a5f] transition-colors"
                          >
                            {pa.projects.project_name}
                          </Link>
                          <p className="text-xs text-[#94a3b8]">{pa.projects.project_code}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-[#64748b]">{pa.role}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${projStatusCfg[pa.projects.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                            {pa.projects.status?.replace(/_/g, " ")}
                          </span>
                          {pa.compliance_checked && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5 ${pa.compliance_passed ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                              {pa.compliance_passed ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            </span>
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
