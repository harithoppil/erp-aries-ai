import { listPersonnel, type ClientSafePersonnel } from "@/app/erp/hr/actions";
import HRClient from "@/app/erp/hr/hr-client";

export default async function HRPage() {
  const result = await listPersonnel();
  const personnel = result.success ? result.personnel : [];
  return <HRClient initialPersonnel={personnel} />;
}
