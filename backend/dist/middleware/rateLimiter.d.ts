/**
 * General API rate limiter
 * Limits requests per IP to prevent abuse
 */
export declare const apiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Rate limiter for analyze endpoint
 * Slightly increased limits for better UX
 */
export declare const analyzeRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict rate limiter for download endpoint
 * Prevents abuse of download bandwidth
 */
export declare const downloadRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict rate limiter for convert endpoint
 * Prevents abuse of resource-intensive conversion operations
 */
export declare const convertRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Lenient rate limiter for queue status endpoints
 * Allows frequent polling for queue state updates
 */
export declare const queueStatusRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map