import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import ProjectDetailClient from '@/app/dashboard/erp/projects/[id]/project-detail-client';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const project = await frappeGetDoc<any>('Project', id);

    const tasks = await frappeGetList<any>('Task', {
      filters: { project: id },
      fields: ['name', 'subject', 'status', 'priority', 'exp_start_date', 'exp_end_date', 'progress'],
      order_by: 'creation desc',
      limit_page_length: 50,
    });

    const record = {
      ...project,
      id: project.name,
      project_name: project.project_name || project.name,
      project_code: project.name,
      status: project.status || 'Open',
      expected_start_date: project.expected_start_date || null,
      expected_end_date: project.expected_end_date || null,
      estimated_costing: project.estimated_costing || 0,
      total_sales_cost: project.total_sales_cost || 0,
      total_purchase_cost: project.total_purchase_cost || 0,
      gross_margin: project.gross_margin || 0,
      tasks: tasks.map((t: any) => ({
        id: t.name,
        subject: t.subject || t.name,
        status: t.status || 'Open',
        priority: t.priority || 'Medium',
        project: id,
        exp_start_date: t.exp_start_date || null,
        exp_end_date: t.exp_end_date || null,
        progress: t.progress || 0,
      })),
      project_assignments: [],
      enquiries: [],
    };

    return <ProjectDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  }
}
