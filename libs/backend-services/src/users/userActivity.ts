import { RedisCacheService } from '../cache/cacheService.js'

// How long a single heartbeat from the site keeps a user counted as "active".
// The frontend sends one every minute while a tab is visible, so this leaves
// room for a couple of missed beats before we consider them away.
export const USER_ACTIVE_WINDOW_SECONDS = 180

function userActivityCacheKey(userId: string): string {
    return `user-active-${userId}`
}

export async function markUserActive(cache: RedisCacheService, userId: string): Promise<void> {
    await cache.set(userActivityCacheKey(userId), Date.now(), USER_ACTIVE_WINDOW_SECONDS)
}

export async function isUserActive(cache: RedisCacheService, userId: string): Promise<boolean> {
    try {
        const { value, cached } = await cache.get<number>(userActivityCacheKey(userId))
        return cached && value !== undefined && value !== null
    } catch (e) {
        // If the cache is unavailable, err on the side of notifying
        console.log('Unable to read user activity', e)
        return false
    }
}
