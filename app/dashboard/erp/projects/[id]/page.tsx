import { prisma } from '@/lib/prisma';
import ProjectDetailClient from '@/app/dashboard/erp/projects/[id]/project-detail-client';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.projects.findUnique({
    where: { id },
    include: {
      tasks: true,
      project_assignments: {
        include: {
          personnel: {
            include: {
              certifications: true,
            },
          },
        },
      },
      enquiries: true,
    },
  });
  if (!record) return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  return <ProjectDetailClient record={JSON.parse(JSON.stringify(record))} />;
}
