import { prisma } from '@/lib/prisma';
import CostCenterDetailClient from './cost-center-detail-client';

export default async function CostCenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const cc = await prisma.costCenter.findUnique({ where: { name: id } });
    if (!cc) throw new Error('Not found');
    const record = {
      name: cc.name, cost_center_name: cc.cost_center_name,
      cost_center_number: cc.cost_center_number, is_group: cc.is_group || false,
      parent_cost_center: cc.parent_cost_center, company: cc.company,
      disabled: cc.disabled || false, docstatus: cc.docstatus || 0,
      lft: cc.lft, rgt: cc.rgt, old_parent: cc.old_parent,
    };
    return <CostCenterDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Cost Center not found</div>; }
}
