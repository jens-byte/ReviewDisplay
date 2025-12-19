import { Hono } from "hono";
import { fetchGoogleReviews, getCachedReviews } from "../services/google";

const reviews = new Hono();

// Get reviews for a place ID
reviews.get("/:placeId", async (c) => {
  const placeId = c.req.param("placeId");

  try {
    const placeInfo = await fetchGoogleReviews(placeId);
    return c.json(placeInfo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // If API fails, try to return cached data
    const cached = getCachedReviews(placeId);
    if (cached.length > 0) {
      return c.json({
        name: "Cached (API unavailable)",
        rating: 0,
        totalReviews: cached.length,
        reviews: cached,
        warning: message,
      });
    }

    return c.json({ error: message }, 500);
  }
});

// Force refresh reviews (bypass cache)
reviews.post("/:placeId/refresh", async (c) => {
  const placeId = c.req.param("placeId");

  // Delete cached reviews to force refresh
  const { db } = await import("../db/schema");
  db.run("DELETE FROM reviews WHERE place_id = ?", [placeId]);

  try {
    const placeInfo = await fetchGoogleReviews(placeId);
    return c.json(placeInfo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default reviews;
