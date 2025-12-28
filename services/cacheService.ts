import { Mod, Game } from '../types';

/**
 * IndexedDB-based cache service for storing large amounts of mod data
 * Supports 50MB+ storage vs localStorage's ~5MB limit
 */

const DB_NAME = 'SeamlessModSwiper';
const DB_VERSION = 1;
const MODS_STORE = 'mods';
const META_STORE = 'meta';

// Cache TTL: 24 hours (mods don't change that often)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let dbInstance: IDBDatabase | null = null;

/**
 * Opens/creates the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for individual mods (keyed by game_modId)
      if (!db.objectStoreNames.contains(MODS_STORE)) {
        const modsStore = db.createObjectStore(MODS_STORE, { keyPath: 'cacheKey' });
        modsStore.createIndex('game', 'game', { unique: false });
        modsStore.createIndex('mod_id', 'mod_id', { unique: false });
      }

      // Store for metadata (cache timestamps, etc.)
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Generates a cache key for a mod
 */
const getModCacheKey = (game: Game, modId: number): string => {
  return `${game}_${modId}`;
};

/**
 * Stores multiple mods in the cache (batch operation)
 */
export const setCachedMods = async (game: Game, mods: Mod[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction([MODS_STORE, META_STORE], 'readwrite');
    const modsStore = tx.objectStore(MODS_STORE);
    const metaStore = tx.objectStore(META_STORE);

    // Store each mod
    for (const mod of mods) {
      const cacheKey = getModCacheKey(game, mod.mod_id);
      modsStore.put({
        cacheKey,
        game,
        mod_id: mod.mod_id,
        data: mod,
        timestamp: Date.now(),
      });
    }

    // Update metadata
    metaStore.put({
      key: `lastUpdate_${game}`,
      timestamp: Date.now(),
      modCount: mods.length,
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`Cached ${mods.length} mods for ${game}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to cache mods:', e);
  }
};

/**
 * Appends new mods to the cache (deduplicates automatically via key)
 */
export const appendToCachedMods = async (game: Game, newMods: Mod[]): Promise<number> => {
  try {
    const db = await openDB();
    const tx = db.transaction(MODS_STORE, 'readwrite');
    const store = tx.objectStore(MODS_STORE);

    let addedCount = 0;

    for (const mod of newMods) {
      const cacheKey = getModCacheKey(game, mod.mod_id);
      
      // Check if already exists
      const existing = await new Promise<any>((resolve) => {
        const req = store.get(cacheKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (!existing) {
        store.put({
          cacheKey,
          game,
          mod_id: mod.mod_id,
          data: mod,
          timestamp: Date.now(),
        });
        addedCount++;
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`Appended ${addedCount} new mods to cache`);
        resolve(addedCount);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to append mods to cache:', e);
    return 0;
  }
};

/**
 * Gets all cached mods for a game
 */
export const getCachedMods = async (game: Game): Promise<Mod[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(MODS_STORE, 'readonly');
    const store = tx.objectStore(MODS_STORE);
    const index = store.index('game');

    return new Promise((resolve, reject) => {
      const request = index.getAll(game);
      request.onsuccess = () => {
        const entries = request.result || [];
        const mods = entries.map((e: any) => e.data as Mod);
        console.log(`Cache hit for ${game}: ${mods.length} mods`);
        resolve(mods);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to get cached mods:', e);
    return [];
  }
};

/**
 * Gets the count of cached mods for a game
 */
export const getCachedModCount = async (game: Game): Promise<number> => {
  try {
    const db = await openDB();
    const tx = db.transaction(MODS_STORE, 'readonly');
    const store = tx.objectStore(MODS_STORE);
    const index = store.index('game');

    return new Promise((resolve, reject) => {
      const request = index.count(game);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to get cached mod count:', e);
    return 0;
  }
};

/**
 * Clears the mod cache for a specific game
 */
export const clearModCache = async (game: Game): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction([MODS_STORE, META_STORE], 'readwrite');
    const modsStore = tx.objectStore(MODS_STORE);
    const metaStore = tx.objectStore(META_STORE);
    const index = modsStore.index('game');

    // Get all keys for this game and delete them
    const keysRequest = index.getAllKeys(game);
    
    return new Promise((resolve, reject) => {
      keysRequest.onsuccess = () => {
        const keys = keysRequest.result;
        keys.forEach(key => modsStore.delete(key));
        metaStore.delete(`lastUpdate_${game}`);
        
        tx.oncomplete = () => {
          console.log(`Cleared ${keys.length} mods from cache for ${game}`);
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      keysRequest.onerror = () => reject(keysRequest.error);
    });
  } catch (e) {
    console.error('Failed to clear mod cache:', e);
  }
};

/**
 * Clears all mod caches
 */
export const clearAllModCaches = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction([MODS_STORE, META_STORE], 'readwrite');
    tx.objectStore(MODS_STORE).clear();
    tx.objectStore(META_STORE).clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('Cleared all mod caches');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to clear all caches:', e);
  }
};

/**
 * Gets cache age in minutes for a specific game
 */
export const getCacheAge = async (game: Game): Promise<number | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);

    return new Promise((resolve) => {
      const request = store.get(`lastUpdate_${game}`);
      request.onsuccess = () => {
        if (request.result) {
          const age = Math.round((Date.now() - request.result.timestamp) / 1000 / 60);
          resolve(age);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
};

/**
 * Filters out already-seen mods from a list
 */
export const filterUnseenMods = (mods: Mod[], seenIds: Set<number>): Mod[] => {
  return mods.filter(m => !seenIds.has(m.mod_id));
};

/**
 * Gets unseen mods from cache for a specific game
 */
export const getUnseenCachedMods = async (game: Game, seenIds: Set<number>): Promise<Mod[]> => {
  const cached = await getCachedMods(game);
  return filterUnseenMods(cached, seenIds);
};

/**
 * Gets the count of unseen mods in cache
 */
export const getUnseenCachedModCount = async (game: Game, seenIds: Set<number>): Promise<number> => {
  const unseen = await getUnseenCachedMods(game, seenIds);
  return unseen.length;
};

/**
 * Checks if cache needs refresh (old or low on unseen mods)
 */
export const shouldRefreshCache = async (
  game: Game, 
  seenIds: Set<number>,
  lowThreshold: number = 20
): Promise<boolean> => {
  const age = await getCacheAge(game);
  
  // Refresh if cache is older than TTL
  if (age !== null && age > CACHE_TTL_MS / 1000 / 60) {
    return true;
  }

  // Refresh if running low on unseen mods
  const unseenCount = await getUnseenCachedModCount(game, seenIds);
  if (unseenCount < lowThreshold) {
    return true;
  }

  return false;
};

// Legacy sync functions for backwards compatibility during migration
// These will be gradually replaced with async versions

/**
 * @deprecated Use async getCachedMods instead
 */
export const getCachedModsSync = (game: Game): Mod[] | null => {
  // Try localStorage fallback for backwards compatibility
  try {
    const cached = localStorage.getItem(`sms_mod_cache_${game}`);
    if (cached) {
      const entry = JSON.parse(cached);
      return entry.mods || null;
    }
  } catch (e) {
    // Ignore
  }
  return null;
};

/**
 * @deprecated Use async getCacheAge instead  
 */
export const getCacheAgeSync = (game: Game): number | null => {
  try {
    const cached = localStorage.getItem(`sms_mod_cache_${game}`);
    if (cached) {
      const entry = JSON.parse(cached);
      return Math.round((Date.now() - entry.timestamp) / 1000 / 60);
    }
  } catch (e) {
    // Ignore
  }
  return null;
};
