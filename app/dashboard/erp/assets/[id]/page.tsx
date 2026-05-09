import { prisma } from '@/lib/prisma';
import AssetDetailClient from '@/app/dashboard/erp/assets/[id]/asset-detail-client';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const asset = await prisma.assets.findUnique({ where: { id } });

    if (!asset) throw new Error('Asset not found');

    const maintenance: any[] = [];

    const record = {
      ...asset,
      id: asset.id,
      asset_name: asset.asset_name || asset.id,
      asset_code: asset.asset_code,
      asset_category: asset.asset_category || 'General',
      status: asset.status || 'Draft',
      location: asset.location || null,
      warehouse_id: asset.warehouse_id || null,
      purchase_date: asset.purchase_date || null,
      purchase_cost: asset.purchase_cost || null,
      current_value: asset.current_value || null,
      depreciation_rate: asset.depreciation_rate || 0,
      calibration_date: asset.calibration_date || null,
      next_calibration_date: asset.next_calibration_date || null,
      calibration_certificate: asset.calibration_certificate || null,
      certification_body: asset.certification_body || null,
      assigned_to_project: asset.assigned_to_project || null,
      assigned_to_personnel: asset.assigned_to_personnel || null,
      notes: asset.notes || null,
      warehouses: null,
      personnel: null,
      projects: null,
      maintenance_records: maintenance.map((m: any) => ({
        id: m.name,
        asset_id: id,
        maintenance_type: m.maintenance_type || 'General',
        performed_date: m.completion_date || new Date().toISOString(),
        notes: m.maintenance_status || '',
      })),
    };

    return <AssetDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Asset not found</div>;
  }
}
