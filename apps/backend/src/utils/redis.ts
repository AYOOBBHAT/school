import { Redis } from '@upstash/redis';
import logger from './logger.js';

/**
 * Upstash Redis REST client.
 * Required env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
const rawUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const url =
  rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;

if (!url) {
  logger.error('Redis is not configured: UPSTASH_REDIS_REST_URL is missing or empty');
}

export const redis = new Redis({
  url: url!,
  token: token!,
});

/** Default cache entry TTL (seconds) — used by cache.ts */
export const CACHE_TTL = 600;

/** Forgot-password OTP record TTL (seconds) */
export const OTP_REDIS_TTL_SECONDS = 600;
