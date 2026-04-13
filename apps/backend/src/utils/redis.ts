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

/**
 * Removes cached unpaid analytics for a school (`unpaid:{schoolId}:...`).
 * Redis DEL does not support globs; uses SCAN + DEL (same intent as `del unpaid:schoolId:*`).
 */
export async function invalidateUnpaidAnalyticsCacheForSchool(schoolId: string): Promise<void> {
  const match = `unpaid:${schoolId}:*`;
  let cursor = '0';
  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match, count: 500 });
      const keyList = (keys ?? []) as string[];
      if (keyList.length > 0) {
        await Promise.all(keyList.map((k) => redis.del(k)));
      }
      cursor = String(nextCursor);
    } while (cursor !== '0');
  } catch (err) {
    logger.warn({ schoolId, err }, '[redis] unpaid analytics cache invalidation failed');
  }
}
