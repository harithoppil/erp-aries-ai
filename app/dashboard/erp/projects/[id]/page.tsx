import { prisma } from '@/lib/prisma';
import ProjectDetailClient from '@/app/dashboard/erp/projects/[id]/project-detail-client';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const project = await prisma.projects.findUnique({ where: { id } });

    if (!project) {
      return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
    }

    const tasks = await prisma.tasks.findMany({
      where: { project_id: id },
      orderBy: { id: 'desc' },
      take: 50,
    });

    const record = {
      ...project,
      id: project.id,
      project_name: project.project_name || project.id,
      project_code: project.project_code || project.id,
      status: project.status || 'Open',
      expected_start_date: project.expected_start?.toISOString() ?? null,
      expected_end_date: project.expected_end?.toISOString() ?? null,
      estimated_costing: project.estimated_cost ?? 0,
      total_sales_cost: 0,
      total_purchase_cost: 0,
      gross_margin: 0,
      tasks: tasks.map((t) => ({
        id: t.id,
        subject: t.subject || t.id,
        status: t.status || 'Open',
        priority: 'Medium',
        project: id,
        exp_start_date: t.start_date?.toISOString() ?? null,
        exp_end_date: t.end_date?.toISOString() ?? null,
        progress: t.progress ?? 0,
      })),
      project_assignments: [],
      enquiries: [],
    };

    return <ProjectDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  }
}
