import { listMaterialRequests, type ClientSafeMaterialRequest } from "@/app/erp/material-requests/actions";
import MaterialRequestsClient from "@/app/erp/material-requests/material-requests-client";

export default async function MaterialRequestsPage() {
  const res = await listMaterialRequests();
  const requests: ClientSafeMaterialRequest[] = res.success ? res.requests : [];
  return <MaterialRequestsClient initialRequests={requests} />;
}
