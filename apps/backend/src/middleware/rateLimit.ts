/**
 * Global Rate Limiting Middleware
 * Limits: 300 requests per minute per IP
 * 
 * Note: Set to 300 to accommodate:
 * - Mobile apps behind NAT
 * - School WiFi (shared IPs)
 * - Multiple users on same network
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per window per IP (supports mobile apps + shared IPs)
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Too many requests. Please slow down.',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
    });
  },
});
