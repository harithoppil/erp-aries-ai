import { listConnectors, type ClientSafeConnector } from "./actions";
import ChannelsClient from "./channels-client";

export default async function ChannelsPage() {
  const res = await listConnectors();
  const connectors: ClientSafeConnector[] = res.success ? res.connectors : [];
  return <ChannelsClient initialConnectors={connectors} />;
}
