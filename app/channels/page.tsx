import { listConnectors, type ClientSafeConnector } from "@/app/channels/actions";
import ChannelsClient from "@/app/channels/channels-client";

export default async function ChannelsPage() {
  const res = await listConnectors();
  const connectors: ClientSafeConnector[] = res.success ? res.connectors : [];
  return <ChannelsClient initialConnectors={connectors} />;
}
