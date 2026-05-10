import { listMaterialRequests, type ClientSafeMaterialRequest } from "@/app/dashboard/erp/material-requests/actions";

export const dynamic = 'force-dynamic';
import MaterialRequestsClient from "@/app/dashboard/erp/material-requests/material-requests-client";

export default async function MaterialRequestsPage() {
  const res = await listMaterialRequests();
  const requests: ClientSafeMaterialRequest[] = res.success ? res.requests : [];
  return <MaterialRequestsClient initialRequests={requests} />;
}
