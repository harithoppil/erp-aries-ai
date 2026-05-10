import { listPersonnel, type ClientSafePersonnel } from "@/app/dashboard/erp/hr/actions";
import HRClient from "@/app/dashboard/erp/hr/hr-client";

export default async function PersonnelListPage() {
  const result = await listPersonnel();
  const personnel = result.success ? result.personnel : [];
  return <HRClient initialPersonnel={personnel} />;
}
