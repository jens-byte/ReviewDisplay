import { reviewQueries, type Review } from "../db/schema";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_DURATION_HOURS = 24;

interface GoogleReview {
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

interface PlaceDetailsResponse {
  result?: {
    name: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: GoogleReview[];
  };
  status: string;
  error_message?: string;
}

export interface PlaceInfo {
  name: string;
  rating: number;
  totalReviews: number;
  reviews: Review[];
}

function generateReviewId(placeId: string, authorName: string, time: number): string {
  const str = `${placeId}-${authorName}-${time}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function fetchGoogleReviews(placeId: string): Promise<PlaceInfo> {
  // Check cache first
  const lastFetch = reviewQueries.getLastFetchTime.get(placeId) as { last_fetch: string | null };

  if (lastFetch?.last_fetch) {
    const lastFetchTime = new Date(lastFetch.last_fetch + "Z").getTime();
    const cacheExpiry = Date.now() - (CACHE_DURATION_HOURS * 60 * 60 * 1000);

    if (lastFetchTime > cacheExpiry) {
      // Return cached reviews
      const cachedReviews = reviewQueries.getByPlaceId.all(placeId) as Review[];
      if (cachedReviews.length > 0) {
        return {
          name: "Cached",
          rating: calculateAverageRating(cachedReviews),
          totalReviews: cachedReviews.length,
          reviews: cachedReviews,
        };
      }
    }
  }

  // Fetch from Google Places API
  if (!GOOGLE_API_KEY) {
    throw new Error("Google Places API key not configured");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,rating,user_ratings_total,reviews");
  url.searchParams.set("reviews_no_translations", "true");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const response = await fetch(url.toString());
  const data = (await response.json()) as PlaceDetailsResponse;

  if (data.status !== "OK") {
    throw new Error(data.error_message || `Google API error: ${data.status}`);
  }

  if (!data.result) {
    throw new Error("No place found");
  }

  const reviews: Review[] = (data.result.reviews || []).map((r) => ({
    id: generateReviewId(placeId, r.author_name, r.time),
    place_id: placeId,
    author_name: r.author_name,
    author_photo: r.profile_photo_url || null,
    rating: r.rating,
    text: r.text,
    time: r.time,
    relative_time: r.relative_time_description,
    fetched_at: new Date().toISOString(),
  }));

  // Cache reviews
  for (const review of reviews) {
    reviewQueries.upsert.run(
      review.id,
      review.place_id,
      review.author_name,
      review.author_photo,
      review.rating,
      review.text,
      review.time,
      review.relative_time
    );
  }

  // Clean old reviews
  reviewQueries.deleteOld.run(placeId);

  return {
    name: data.result.name,
    rating: data.result.rating || 0,
    totalReviews: data.result.user_ratings_total || 0,
    reviews,
  };
}

function calculateAverageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function getCachedReviews(placeId: string): Review[] {
  return reviewQueries.getByPlaceId.all(placeId) as Review[];
}
