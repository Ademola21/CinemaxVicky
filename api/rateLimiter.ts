/**
 * A simple in-memory rate limiter for the serverless function environment.
 * It tracks request timestamps for each user ID in a map.
 * NOTE: In a distributed serverless environment (with multiple instances), a shared
 * store like Redis or Memcached would be necessary for a consistent global rate limit.
 * For a single-instance or low-traffic scenario, this in-memory approach is sufficient.
 */

const userRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // Allow up to 20 AI requests per minute per user

/**
 * Checks if a user has exceeded the request rate limit.
 * @param userId The unique identifier for the user.
 * @returns An object indicating if the user is limited and an optional retry-after duration in seconds.
 */
export function checkRateLimit(userId: string): { limited: boolean; retryAfter?: number } {
    const now = Date.now();
    const userTimestamps = userRequests.get(userId) || [];

    // Filter out timestamps that are older than our time window
    const recentTimestamps = userTimestamps.filter(
        timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        // User has exceeded the limit
        const oldestRequest = recentTimestamps[0];
        const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestRequest)) / 1000);
        console.warn(`Rate limit exceeded for user: ${userId}`);
        return { limited: true, retryAfter };
    }

    // Add the current request's timestamp and update the map
    recentTimestamps.push(now);
    userRequests.set(userId, recentTimestamps);

    return { limited: false };
}
