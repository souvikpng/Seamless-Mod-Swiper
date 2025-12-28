import { Mod, Game } from '../types';

/**
 * Cache entry structure for storing mods
 */
interface ModCacheEntry {
  mods: Mod[];
  timestamp: number;
  game: Game;
}

// Cache TTL: 1 hour (in milliseconds)
const CACHE_TTL_MS = 60 * 60 * 1000;

// localStorage key prefix
const CACHE_KEY_PREFIX = 'sms_mod_cache_';

/**
 * Gets the cache key for a specific game
 */
const getCacheKey = (game: Game): string => {
  return `${CACHE_KEY_PREFIX}${game}`;
};

/**
 * Checks if a cache entry is still valid (not expired)
 */
const isCacheValid = (entry: ModCacheEntry): boolean => {
  const now = Date.now();
  return now - entry.timestamp < CACHE_TTL_MS;
};

/**
 * Retrieves cached mods for a game if available and not expired
 * @param game The game to get cached mods for
 * @returns Cached mods array or null if no valid cache exists
 */
export const getCachedMods = (game: Game): Mod[] | null => {
  try {
    const cacheKey = getCacheKey(game);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const entry: ModCacheEntry = JSON.parse(cached);
    
    if (!isCacheValid(entry)) {
      // Cache expired, remove it
      localStorage.removeItem(cacheKey);
      console.log(`Cache expired for ${game}, removed`);
      return null;
    }
    
    console.log(`Cache hit for ${game}: ${entry.mods.length} mods (age: ${Math.round((Date.now() - entry.timestamp) / 1000 / 60)}min)`);
    return entry.mods;
  } catch (e) {
    console.error('Failed to read mod cache:', e);
    return null;
  }
};

/**
 * Stores mods in the cache for a specific game
 * @param game The game to cache mods for
 * @param mods The mods to cache
 */
export const setCachedMods = (game: Game, mods: Mod[]): void => {
  try {
    const cacheKey = getCacheKey(game);
    const entry: ModCacheEntry = {
      mods,
      timestamp: Date.now(),
      game,
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    console.log(`Cached ${mods.length} mods for ${game}`);
  } catch (e) {
    console.error('Failed to write mod cache:', e);
    // If localStorage is full, try to clear old caches
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      clearAllModCaches();
    }
  }
};

/**
 * Adds new mods to an existing cache (merges and deduplicates)
 * @param game The game to update cache for
 * @param newMods New mods to add to the cache
 */
export const appendToCachedMods = (game: Game, newMods: Mod[]): void => {
  const existingMods = getCachedMods(game) || [];
  
  // Merge and deduplicate by mod_id
  const seenIds = new Set(existingMods.map(m => m.mod_id));
  const uniqueNewMods = newMods.filter(m => !seenIds.has(m.mod_id));
  
  const mergedMods = [...existingMods, ...uniqueNewMods];
  setCachedMods(game, mergedMods);
  
  console.log(`Appended ${uniqueNewMods.length} new mods to cache (total: ${mergedMods.length})`);
};

/**
 * Clears the mod cache for a specific game
 * @param game The game to clear cache for
 */
export const clearModCache = (game: Game): void => {
  const cacheKey = getCacheKey(game);
  localStorage.removeItem(cacheKey);
  console.log(`Cleared mod cache for ${game}`);
};

/**
 * Clears all mod caches
 */
export const clearAllModCaches = (): void => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
  console.log('Cleared all mod caches');
};

/**
 * Gets cache age in minutes for a specific game
 * @param game The game to check cache age for
 * @returns Age in minutes, or null if no cache exists
 */
export const getCacheAge = (game: Game): number | null => {
  try {
    const cacheKey = getCacheKey(game);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const entry: ModCacheEntry = JSON.parse(cached);
    return Math.round((Date.now() - entry.timestamp) / 1000 / 60);
  } catch {
    return null;
  }
};

/**
 * Filters out already-seen mods from a list
 * @param mods The mods to filter
 * @param seenIds Set of mod IDs that have been seen
 * @returns Filtered list of unseen mods
 */
export const filterUnseenMods = (mods: Mod[], seenIds: Set<number>): Mod[] => {
  return mods.filter(m => !seenIds.has(m.mod_id));
};

/**
 * Gets the count of unseen mods in cache for a specific game
 * @param game The game to check
 * @param seenIds Set of mod IDs that have been seen
 * @returns Count of unseen mods, or 0 if no cache
 */
export const getUnseenCachedModCount = (game: Game, seenIds: Set<number>): number => {
  const cached = getCachedMods(game);
  if (!cached) return 0;
  return filterUnseenMods(cached, seenIds).length;
};
