import { Redis } from '@upstash/redis';

/**
 * Upstash Redis REST client.
 * Required env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = new Redis({
  url: url!,
  token: token!,
});

/** Default cache entry TTL (seconds) — used by cache.ts */
export const CACHE_TTL = 600;

/** Forgot-password OTP record TTL (seconds) */
export const OTP_REDIS_TTL_SECONDS = 600;
