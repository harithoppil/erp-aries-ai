import { prisma } from '@/lib/prisma';
import PersonnelDetailClient from '@/app/dashboard/erp/hr/[id]/personnel-detail-client';

interface CertificationSummary {
  id: string;
  cert_type: string | null;
  cert_number: string | null;
  issuing_body: string | null;
  issue_date: Date | null;
  expiry_date: Date | null;
  status: string;
}

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const employee = await prisma.personnel.findUnique({ where: { id } });

    if (!employee) throw new Error('Personnel not found');

    const certifications = await prisma.certifications.findMany({ where: { personnel_id: id } });

    const record = {
      ...employee,
      id: employee.id,
      first_name: employee.first_name || 'Unknown',
      last_name: employee.last_name || null,
      email: employee.email || null,
      designation: employee.designation || null,
      department: employee.department || null,
      status: employee.status || 'Active',
      date_of_joining: null,
      certifications: certifications.map((c: CertificationSummary) => ({
        id: c.id,
        personnel_id: id,
        cert_type: c.cert_type || 'Certification',
        cert_number: c.cert_number || null,
        issuing_body: c.issuing_body || null,
        issue_date: c.issue_date || null,
        expiry_date: c.expiry_date || null,
        status: c.status || 'Valid',
      })),
      project_assignments: [],
    };

    return <PersonnelDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Personnel not found</div>;
  }
}
