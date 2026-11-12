// A small in-memory rate limiter. Counts requests per key in a sliding window.
// It's per server process: if the API runs on several instances, put a shared
// store (e.g. Redis) behind it instead.
const buckets = new Map();

function hit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length <= limit;
}

// Express middleware. `keyFn(req)` returns one or more keys to count against;
// the request is refused when any of them is over the limit.
function rateLimit({ name, limit, windowMs, keyFn = (req) => req.ip, message }) {
  return (req, res, next) => {
    const keys = [].concat(keyFn(req)).filter(Boolean).map((k) => `${name}:${String(k).toLowerCase()}`);
    const allowed = keys.map((k) => hit(k, limit, windowMs)).every(Boolean);
    if (allowed) return next();
    res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
    return res.status(429).json({ msg: message || "Too many attempts. Please wait a while and try again." });
  };
}

// Old entries are dropped now and then so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of buckets) {
    if (!times.some((t) => now - t < 24 * 3600e3)) buckets.delete(key);
  }
}, 3600e3).unref();

const resetRateLimits = () => buckets.clear();

module.exports = { rateLimit, resetRateLimits };
