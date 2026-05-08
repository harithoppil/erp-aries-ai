import { listConnectors, type ClientSafeConnector } from "@/app/dashboard/channels/actions";
import ChannelsClient from "@/app/dashboard/channels/channels-client";

export default async function ChannelsPage() {
  const res = await listConnectors();
  const connectors: ClientSafeConnector[] = res.success ? res.connectors : [];
  return <ChannelsClient initialConnectors={connectors} />;
}
