import { redis, CACHE_TTL } from './upstash.js';
/**
 * Cache-aside pattern: Check cache first, fetch if miss, store result
 * @param key - Cache key (must include schoolId for multi-tenant safety)
 * @param fetcher - Function that fetches fresh data from database
 * @returns Cached data if available, otherwise fresh data
 */
export async function cacheFetch(key, fetcher) {
    try {
        // Try to get from cache
        const cached = await redis.get(key);
        if (cached !== null) {
            return cached;
        }
        // Cache miss - fetch fresh data
        const fresh = await fetcher();
        // Store in cache with TTL
        await redis.set(key, fresh, { ex: CACHE_TTL });
        return fresh;
    }
    catch (error) {
        // If Redis fails, fall back to direct fetch (graceful degradation)
        console.error('[cache] Redis error, falling back to direct fetch:', error);
        return fetcher();
    }
}
/**
 * Invalidate cache entry (used after writes)
 * @param key - Cache key to invalidate (supports wildcard patterns like "school:123:salary:unpaid:*")
 */
export async function invalidateCache(key) {
    try {
        if (key.includes('*')) {
            // Wildcard pattern - invalidate all matching keys
            // For Upstash Redis, we need to invalidate all possible combinations
            // Since we know the pattern, we'll invalidate common time scopes
            const baseKey = key.replace(/\*/g, '');
            const timeScopes = ['last_month', 'last_2_months', 'last_3_months', 'last_6_months', 'last_12_months', 'current_academic_year'];
            const suffixes = ['all', ...timeScopes];
            const keysToDelete = [];
            for (const suffix of suffixes) {
                keysToDelete.push(`${baseKey}${suffix}`);
            }
            if (keysToDelete.length > 0) {
                // Delete all matching keys
                await Promise.all(keysToDelete.map(k => redis.del(k).catch(() => { })));
            }
        }
        else {
            await redis.del(key);
        }
    }
    catch (error) {
        // Log but don't throw - cache invalidation failure shouldn't break the request
        console.error('[cache] Failed to invalidate cache:', error);
    }
}
