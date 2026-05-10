export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import ProjectDetailClient from '@/app/dashboard/erp/projects/[id]/project-detail-client';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const project = await prisma.project.findUnique({ where: { name: id } });
    if (!project) {
      return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
    }

    const tasks = await prisma.task.findMany({
      where: { project: id },
      orderBy: { creation: 'desc' },
      take: 50,
    });

    const record = {
      id: project.name,
      project_name: project.project_name || project.name,
      project_code: project.name,
      project_type: project.project_type || null,
      status: project.status || 'Open',
      customer_name: project.customer || '',
      expected_start: project.expected_start_date?.toISOString() ?? null,
      expected_end: project.expected_end_date?.toISOString() ?? null,
      actual_start: project.actual_start_date?.toISOString() ?? null,
      actual_end: project.actual_end_date?.toISOString() ?? null,
      project_location: project.department || null,
      vessel_name: null,
      estimated_cost: Number(project.estimated_costing || 0),
      actual_cost: Number(project.total_costing_amount || 0),
      day_rate: null,
      currency: 'AED',
      notes: project.notes || null,
      tasks: tasks.map((t) => ({
        id: t.name,
        subject: t.subject || t.name,
        description: t.description || null,
        status: t.status || 'Open',
        assigned_to: null,
        start_date: t.exp_start_date?.toISOString() ?? null,
        end_date: t.exp_end_date?.toISOString() ?? null,
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
