import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import PersonnelDetailClient from '@/app/dashboard/erp/hr/[id]/personnel-detail-client';

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const employee = await frappeGetDoc<any>('Employee', id);

    const certifications = await frappeGetList<any>('Certification', {
      filters: { employee: id },
      fields: ['name', 'certification_name', 'certification_number', 'issuing_body', 'issue_date', 'expiry_date', 'status'],
      order_by: 'creation desc',
      limit_page_length: 50,
    });

    const record = {
      ...employee,
      id: employee.name,
      first_name: employee.first_name || 'Unknown',
      last_name: employee.last_name || null,
      email: employee.personal_email || null,
      designation: employee.designation || null,
      department: employee.department || null,
      status: employee.status || 'Active',
      date_of_joining: employee.date_of_joining || null,
      certifications: certifications.map((c: any) => ({
        id: c.name,
        personnel_id: id,
        cert_type: c.certification_name || 'Certification',
        cert_number: c.certification_number || null,
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
