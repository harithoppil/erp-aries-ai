import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import AssetDetailClient from '@/app/dashboard/erp/assets/[id]/asset-detail-client';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const asset = await frappeGetDoc<any>('Asset', id);

    const maintenance = await frappeGetList<any>('Asset Maintenance Log', {
      filters: { asset_name: asset.asset_name || id },
      fields: ['name', 'maintenance_type', 'completion_date', 'maintenance_status'],
      order_by: 'completion_date desc',
      limit_page_length: 20,
    });

    const record = {
      ...asset,
      id: asset.name,
      asset_name: asset.asset_name || asset.name,
      asset_code: asset.name,
      asset_category: asset.asset_category || 'General',
      status: asset.status || 'Draft',
      location: asset.location || null,
      warehouse_id: null,
      purchase_date: asset.purchase_date || null,
      purchase_cost: asset.purchase_amount || null,
      current_value: asset.value_after_depreciation || null,
      depreciation_rate: 0,
      calibration_date: null,
      next_calibration_date: null,
      calibration_certificate: null,
      certification_body: null,
      assigned_to_project: null,
      assigned_to_personnel: null,
      notes: null,
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
