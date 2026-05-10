export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import AssetDetailClient from '@/app/dashboard/erp/assets/[id]/asset-detail-client';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const asset = await prisma.asset.findUnique({ where: { name: id } });
    if (!asset) throw new Error('Asset not found');

    const record = {
      id: asset.name,
      asset_name: asset.asset_name || asset.name,
      asset_code: asset.item_code || asset.name,
      asset_category: asset.asset_category || 'General',
      status: asset.docstatus === 1 ? 'AVAILABLE' : 'DRAFT',
      location: asset.location || null,
      warehouse_id: null,
      purchase_date: asset.purchase_date?.toISOString().slice(0, 10) ?? null,
      purchase_cost: Number(asset.value_after_depreciation || 0),
      current_value: Number(asset.value_after_depreciation || 0),
      depreciation_rate: 0,
      calibration_date: null,
      next_calibration_date: asset.next_depreciation_date?.toISOString().slice(0, 10) ?? null,
      calibration_certificate: null,
      certification_body: null,
      assigned_to_project: null,
      assigned_to_personnel: asset.custodian || null,
      notes: null,
      warehouses: null,
      personnel: null,
      projects: null,
      maintenance_records: [],
    };

    return <AssetDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Asset not found</div>;
  }
}
