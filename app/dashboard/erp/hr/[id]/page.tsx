import { prisma } from '@/lib/prisma';
import PersonnelDetailClient from '@/app/dashboard/erp/hr/[id]/personnel-detail-client';

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.personnel.findUnique({
    where: { id },
    include: {
      certifications: true,
      project_assignments: {
        include: {
          projects: true,
        },
        orderBy: { id: 'desc' },
      },
    },
  });
  if (!record) return <div className="p-8 text-center text-muted-foreground">Personnel not found</div>;
  return <PersonnelDetailClient record={JSON.parse(JSON.stringify(record))} />;
}
