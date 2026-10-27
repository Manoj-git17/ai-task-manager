/**
 * Rate Limiter Middleware for Express (In-Memory Sliding Window)
 * Zero external dependencies. Defends against brute-force attacks and abuse.
 * Automatically evicts expired IP tracking entries to prevent memory leaks.
 */

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // Default: 15 minutes
  const max = options.max || 100; // Default: 100 requests per window
  const message =
    options.message || "Too many requests from this IP. Please try again later.";
  const statusCode = options.statusCode || 429;

  // Map of IP -> { count: number, resetTime: number }
  const hits = new Map();

  // Periodic eviction interval (runs every 5 minutes)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits.entries()) {
      if (now > entry.resetTime) {
        hits.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Prevent cleanup timer from keeping Node process alive during tests or shutdown
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    // CORS preflight requests must never be rate limited
    if (req.method === "OPTIONS") {
      return next();
    }

    // Determine client IP safely
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown-ip";

    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(ip, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, max - entry.count);
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(statusCode).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    }

    return next();
  };

  // Expose a helper to reset tracker during testing
  limiterMiddleware.reset = () => hits.clear();

  return limiterMiddleware;
}

module.exports = createRateLimiter;
