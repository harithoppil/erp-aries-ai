import { ERPDashboard } from '@/app/dashboard/erp/erp-dashboard-client';

export default async function ERPPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ERP Dashboard</h1>
      </div>
      <ERPDashboard />
    </div>
  );
}
