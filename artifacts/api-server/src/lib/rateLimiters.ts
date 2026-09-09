import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV === "development";

export const aiLimiter = rateLimit({
  windowMs: isDev ? 1000 : 15 * 60 * 1000,
  max: isDev ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({ error: `Previše zahtjeva, pokušajte ponovo za ${retryAfter} sekundi.` });
  },
});

export const scraperLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({ error: `Previše zahtjeva, pokušajte ponovo za ${retryAfter} sekundi.` });
  },
});
