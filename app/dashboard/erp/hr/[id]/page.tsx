export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import PersonnelDetailClient from '@/app/dashboard/erp/hr/[id]/personnel-detail-client';

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const employee = await prisma.employee.findUnique({ where: { name: id } });
    if (!employee) throw new Error('Personnel not found');

    const record = {
      id: employee.name,
      first_name: employee.first_name || 'Unknown',
      last_name: employee.last_name || null,
      email: employee.user_id || null,
      designation: employee.designation || null,
      department: employee.department || null,
      status: employee.status || 'Active',
      date_of_joining: employee.date_of_joining?.toISOString() ?? null,
      certifications: [],
      project_assignments: [],
    };

    return <PersonnelDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Personnel not found</div>;
  }
}
