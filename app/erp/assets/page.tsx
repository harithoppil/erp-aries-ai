import { listAssets, type ClientSafeAsset } from "./actions";
import AssetsClient from "./assets-client";

export default async function AssetsPage() {
  const result = await listAssets();
  const assets = result.success ? result.assets : [];

  return <AssetsClient initialAssets={assets} />;
}
