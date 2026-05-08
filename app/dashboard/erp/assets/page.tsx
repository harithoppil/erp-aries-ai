import { listAssets, type ClientSafeAsset } from "@/app/dashboard/erp/assets/actions";
import AssetsClient from "@/app/dashboard/erp/assets/assets-client";

export default async function AssetsPage() {
  const result = await listAssets();
  const assets = result.success ? result.assets : [];

  return <AssetsClient initialAssets={assets} />;
}
