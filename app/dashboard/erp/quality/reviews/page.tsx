import { listReviews, type ClientSafeReview } from './actions';
import ReviewsClient from './reviews-client';

export default async function ReviewsPage() {
  const result = await listReviews();
  const reviews = result.success ? result.reviews : [];
  return <ReviewsClient initialReviews={reviews} />;
}
