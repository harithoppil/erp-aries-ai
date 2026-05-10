import { listSubscriptions, type ClientSafeSubscription } from './actions';
import SubscriptionsClient from './subscriptions-client';

export default async function SubscriptionsPage() {
  const result = await listSubscriptions();
  const subscriptions = result.success ? result.subscriptions : [];
  return <SubscriptionsClient initialSubscriptions={subscriptions} />;
}
