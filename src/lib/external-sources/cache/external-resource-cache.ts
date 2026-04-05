type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const searchCache = new Map<string, CacheEntry<unknown>>();
const resourceCache = new Map<string, CacheEntry<unknown>>();

function getFromCache<T>(store: Map<string, CacheEntry<unknown>>, key: string): T | null {
  const found = store.get(key);
  if (!found) return null;
  if (Date.now() > found.expiresAt) {
    store.delete(key);
    return null;
  }
  return found.value as T;
}

function setToCache<T>(
  store: Map<string, CacheEntry<unknown>>,
  key: string,
  value: T,
  ttlMs: number
) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function getSearchCache<T>(key: string) {
  return getFromCache<T>(searchCache, key);
}

export function setSearchCache<T>(key: string, value: T, ttlMs: number) {
  setToCache(searchCache, key, value, ttlMs);
}

export function getResourceCache<T>(key: string) {
  return getFromCache<T>(resourceCache, key);
}

export function setResourceCache<T>(key: string, value: T, ttlMs: number) {
  setToCache(resourceCache, key, value, ttlMs);
}
