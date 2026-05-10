import { listFeedbacks, type ClientSafeFeedback } from './actions';
import FeedbackClient from './feedback-client';

export default async function FeedbackPage() {
  const result = await listFeedbacks();
  const feedbacks = result.success ? result.feedbacks : [];
  return <FeedbackClient initialFeedbacks={feedbacks} />;
}
