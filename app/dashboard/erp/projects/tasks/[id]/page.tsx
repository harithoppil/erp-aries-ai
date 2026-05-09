import { prisma } from '@/lib/prisma';
import TaskDetailClient from './task-detail-client';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const t = await prisma.task.findUnique({ where: { name: id } });
    if (!t) throw new Error('Not found');
    const record = {
      name: t.name, subject: t.subject, status: t.status || 'Open',
      priority: t.priority, project: t.project,
      exp_start_date: t.exp_start_date, exp_end_date: t.exp_end_date,
      progress: t.progress ? Number(t.progress) : null,
      is_milestone: t.is_milestone || false, assigned_to: t.completed_by,
      docstatus: t.docstatus || 0, type: t.type,
      is_group: t.is_group || false, description: t.description,
      actual_time: t.actual_time ? Number(t.actual_time) : null,
      act_start_date: t.act_start_date, act_end_date: t.act_end_date,
      department: t.department, company: t.company,
    };
    return <TaskDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Task not found</div>; }
}
