// Simple in-memory cache with TTL support for expensive query results
// Values are stored per-process; cache survives across requests in the same container

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<any>>()

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const cached = cache.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.value as T
  }

  const value = await compute()
  cache.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000,
  })

  return value
}

export function invalidateCache(key: string): void {
  cache.delete(key)
}

export function invalidateCachePattern(pattern: string | RegExp): void {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key)
    }
  }
}

export function clearCache(): void {
  cache.clear()
}

export function getCacheStats() {
  return {
    entries: cache.size,
    keys: Array.from(cache.keys()),
  }
}
