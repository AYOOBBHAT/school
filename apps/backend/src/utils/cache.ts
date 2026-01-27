import { redis, CACHE_TTL } from './upstash';

/**
 * Cache-aside pattern: Check cache first, fetch if miss, store result
 * @param key - Cache key (must include schoolId for multi-tenant safety)
 * @param fetcher - Function that fetches fresh data from database
 * @returns Cached data if available, otherwise fresh data
 */
export async function cacheFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    // Try to get from cache
    const cached = await redis.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch fresh data
    const fresh = await fetcher();

    // Store in cache with TTL
    await redis.set(key, fresh, { ex: CACHE_TTL });

    return fresh;
  } catch (error) {
    // If Redis fails, fall back to direct fetch (graceful degradation)
    console.error('[cache] Redis error, falling back to direct fetch:', error);
    return fetcher();
  }
}

/**
 * Invalidate cache entry (used after writes)
 * @param key - Cache key to invalidate
 */
export async function invalidateCache(key: string) {
  try {
    await redis.del(key);
  } catch (error) {
    // Log but don't throw - cache invalidation failure shouldn't break the request
    console.error('[cache] Failed to invalidate cache:', error);
  }
}
