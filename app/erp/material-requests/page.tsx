import { listMaterialRequests, type ClientSafeMaterialRequest } from "./actions";
import MaterialRequestsClient from "./material-requests-client";

export default async function MaterialRequestsPage() {
  const res = await listMaterialRequests();
  const requests: ClientSafeMaterialRequest[] = res.success ? res.requests : [];
  return <MaterialRequestsClient initialRequests={requests} />;
}
