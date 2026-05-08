import { listPersonnel, type ClientSafePersonnel } from "./actions";
import HRClient from "./hr-client";

export default async function HRPage() {
  const result = await listPersonnel();
  const personnel = result.success ? result.personnel : [];
  return <HRClient initialPersonnel={personnel} />;
}
