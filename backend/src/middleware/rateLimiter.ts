import rateLimit from 'express-rate-limit';

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 */
function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

/**
 * General API rate limiter
 * Limits requests per IP to prevent abuse
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => {
    // 🟢 PROPER RATE LIMITING: Skip /api/progress and /api/queue
    const path = req.path || req.originalUrl?.split('?')[0] || '';
    
    // Skip health checks
    if (path === '/health') {
      return true;
    }
    
    // Skip progress endpoints (SSE connections)
    if (path.startsWith('/api/progress')) {
      return true;
    }
    
    // Skip queue endpoints (they have their own rate limiters)
    if (path.startsWith('/api/queue')) {
      return true;
    }
    
    return false;
  },
});

/**
 * Rate limiter for analyze endpoint
 * Slightly increased limits for better UX
 */
export const analyzeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.ANALYZE_RATE_LIMIT_MAX || '30', 10), // Limit each IP to 30 analyze requests per windowMs (increased from 20)
  message: {
    error: {
      message: 'Too many analysis requests. Please wait before trying again.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Strict rate limiter for download endpoint
 * Prevents abuse of download bandwidth
 */
export const downloadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX || '10', 10), // Limit each IP to 10 downloads per hour
  message: {
    error: {
      message: 'Download limit exceeded. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Strict rate limiter for convert endpoint
 * Prevents abuse of resource-intensive conversion operations
 */
export const convertRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.CONVERT_RATE_LIMIT_MAX || '5', 10), // Limit each IP to 5 conversions per hour
  message: {
    error: {
      message: 'Conversion limit exceeded. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Lenient rate limiter for queue status endpoints
 * Allows frequent polling for queue state updates
 */
export const queueStatusRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.QUEUE_STATUS_RATE_LIMIT_MAX || '300', 10), // Limit each IP to 300 requests per minute (5 per second)
  message: {
    error: {
      message: 'Too many queue status requests. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  // Skip if already rate limited (allow burst)
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

