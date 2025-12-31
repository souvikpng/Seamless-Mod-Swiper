import { NEXUS_API_BASE, MOCK_MODS } from '../constants';
import { Mod, Game } from '../types';

/**
 * Rate limit information from Nexus API response headers
 */
export interface RateLimitInfo {
  hourlyLimit: number;
  hourlyRemaining: number;
  dailyLimit: number;
  dailyRemaining: number;
}

/**
 * Response wrapper that includes rate limit info
 */
export interface FetchModsResponse {
  mods: Mod[];
  rateLimit: RateLimitInfo | null;
}

/**
 * Progress callback for bulk fetching
 */
export interface FetchProgress {
  phase: 'pool' | 'fetching' | 'lists' | 'complete';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: FetchProgress) => void;

/**
 * Parses rate limit headers from Nexus API response
 */
const parseRateLimitHeaders = (response: Response): RateLimitInfo | null => {
  const hourlyLimit = response.headers.get('x-rl-hourly-limit');
  const hourlyRemaining = response.headers.get('x-rl-hourly-remaining');
  const dailyLimit = response.headers.get('x-rl-daily-limit');
  const dailyRemaining = response.headers.get('x-rl-daily-remaining');

  if (hourlyRemaining && dailyRemaining) {
    return {
      hourlyLimit: parseInt(hourlyLimit || '100', 10),
      hourlyRemaining: parseInt(hourlyRemaining, 10),
      dailyLimit: parseInt(dailyLimit || '2000', 10),
      dailyRemaining: parseInt(dailyRemaining, 10),
    };
  }
  return null;
};

/**
 * Standard headers for Nexus API requests
 */
const getHeaders = (apiKey: string) => ({
  'apikey': apiKey,
  'Application-Name': 'Seamless Mod Swiper',
  'Application-Version': '1.0.0',
});

/**
 * Checks if a mod has valid data for display
 * Mods under moderation or hidden may return with missing fields
 */
const isValidMod = (mod: Mod): boolean => {
  // Must have a name (not undefined, not empty)
  if (!mod.name || mod.name.trim() === '') return false;
  
  // Must have either a picture or summary
  if (!mod.picture_url && !mod.summary) return false;
  
  // Check status if available - filter out non-published mods
  if (mod.status && mod.status !== 'published') return false;
  
  // Check available flag if present
  if (mod.available === false) return false;
  
  return true;
};

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Delay helper for rate limiting
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches the list of recently updated mod IDs
 * This endpoint returns a large list (hundreds) of mod IDs that were updated in the period
 * We use this as our "pool" of random mods to choose from
 */
const fetchUpdatedModIds = async (
  apiKey: string,
  game: Game,
  period: '1d' | '1w' | '1m' = '1m'
): Promise<{ modIds: number[]; rateLimit: RateLimitInfo | null }> => {
  const url = `${NEXUS_API_BASE}/games/${game}/mods/updated.json?period=${period}`;
  
  const response = await fetch(url, {
    headers: getHeaders(apiKey),
  });

  const rateLimit = parseRateLimitHeaders(response);

  if (!response.ok) {
    throw new Error(`Failed to fetch updated mods: ${response.status}`);
  }

  const data = await response.json();
  const modIds = (Array.isArray(data) ? data : []).map((item: any) => item.mod_id as number);
  
  return { modIds, rateLimit };
};

/**
 * Fetches detailed info for a single mod
 */
const fetchModDetails = async (
  apiKey: string,
  game: Game,
  modId: number
): Promise<{ mod: Mod | null; rateLimit: RateLimitInfo | null }> => {
  const url = `${NEXUS_API_BASE}/games/${game}/mods/${modId}.json`;
  
  try {
    const response = await fetch(url, {
      headers: getHeaders(apiKey),
    });

    const rateLimit = parseRateLimitHeaders(response);

    if (!response.ok) {
      // Mod might be deleted or hidden - not a fatal error
      console.warn(`Mod ${modId} not available: ${response.status}`);
      return { mod: null, rateLimit };
    }

    const mod = await response.json();
    return { 
      mod: { ...mod, domain_name: mod.domain_name || game },
      rateLimit 
    };
  } catch (error) {
    console.warn(`Failed to fetch mod ${modId}:`, error);
    return { mod: null, rateLimit: null };
  }
};

/**
 * Fetches mods from a list endpoint (trending, latest_added, latest_updated)
 */
const fetchFromListEndpoint = async (
  apiKey: string,
  game: Game,
  endpoint: string
): Promise<{ mods: Mod[]; rateLimit: RateLimitInfo | null }> => {
  const url = `${NEXUS_API_BASE}/games/${game}/mods/${endpoint}.json`;
  
  const response = await fetch(url, {
    headers: getHeaders(apiKey),
  });

  const rateLimit = parseRateLimitHeaders(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid API Key. Please check your Nexus Mods API key.");
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      throw new Error(`Rate limited by Nexus API. Please wait ${retryAfter} seconds before trying again.`);
    }
    if (response.status === 403) {
      throw new Error("Access forbidden. Your API key may not have permission for this request.");
    }
    throw new Error(`Nexus API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  const mods = (Array.isArray(data) ? data : [])
    .map((mod: Mod) => ({
      ...mod,
      domain_name: mod.domain_name || game,
    }))
    .filter(isValidMod);

  return { mods, rateLimit };
};

/**
 * Bulk fetch mods with progress reporting
 * 
 * @param apiKey - Nexus API key
 * @param game - Target game
 * @param count - Number of mods to fetch (default 300)
 * @param onProgress - Progress callback
 * @param excludeIds - Set of mod IDs to skip (already cached/seen)
 */
export const fetchModsBulk = async (
  apiKey: string,
  game: Game,
  count: number = 300,
  onProgress?: ProgressCallback,
  excludeIds: Set<number> = new Set()
): Promise<FetchModsResponse> => {
  if (!apiKey) {
    console.warn("No API Key provided, returning mocks for UI demo.");
    await delay(1500);
    return {
      mods: MOCK_MODS.map(m => ({
        ...m,
        mod_id: m.mod_id + Math.floor(Math.random() * 10000),
        domain_name: game,
      })),
      rateLimit: null,
    };
  }

  try {
    let latestRateLimit: RateLimitInfo | null = null;
    const allMods: Mod[] = [];
    const seenIds = new Set<number>(excludeIds);

    // Phase 1: Get mod ID pool from multiple time periods
    onProgress?.({ phase: 'pool', current: 0, total: 3, message: 'Fetching mod ID pool...' });

    const poolPromises = [
      fetchUpdatedModIds(apiKey, game, '1m'),
      fetchUpdatedModIds(apiKey, game, '1w'),
      fetchUpdatedModIds(apiKey, game, '1d'),
    ];

    const poolResults = await Promise.allSettled(poolPromises);
    const allModIds = new Set<number>();
    
    for (const result of poolResults) {
      if (result.status === 'fulfilled') {
        if (result.value.rateLimit) latestRateLimit = result.value.rateLimit;
        result.value.modIds.forEach(id => {
          if (!seenIds.has(id)) {
            allModIds.add(id);
          }
        });
      } else {
        console.warn('Failed to fetch updated mod IDs for one period:', result.reason);
      }
    }

    onProgress?.({ phase: 'pool', current: 3, total: 3, message: `Found ${allModIds.size} unique mod IDs` });

    // Shuffle and pick the mods we want to fetch
    const shuffledIds = shuffleArray(Array.from(allModIds));
    const idsToFetch = shuffledIds.slice(0, count);

    console.log(`Fetching details for ${idsToFetch.length} mods...`);

    // Phase 2: Fetch individual mod details in batches
    const batchSize = 10; // Concurrent requests per batch
    const delayBetweenBatches = 100; // ms between batches to be nice to the API
    
    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batch = idsToFetch.slice(i, i + batchSize);
      
      onProgress?.({ 
        phase: 'fetching', 
        current: Math.min(i + batchSize, idsToFetch.length), 
        total: idsToFetch.length, 
        message: `Fetching mods ${i + 1}-${Math.min(i + batchSize, idsToFetch.length)} of ${idsToFetch.length}...` 
      });

      const results = await Promise.all(
        batch.map(id => fetchModDetails(apiKey, game, id))
      );

      for (const result of results) {
        if (result.rateLimit) latestRateLimit = result.rateLimit;
        if (result.mod && isValidMod(result.mod) && !seenIds.has(result.mod.mod_id)) {
          seenIds.add(result.mod.mod_id);
          allMods.push(result.mod);
        }
      }

      // Check rate limits and slow down if needed
      if (latestRateLimit && latestRateLimit.hourlyRemaining < 50) {
        console.warn('Rate limit getting low, slowing down...');
        await delay(500);
      } else if (i + batchSize < idsToFetch.length) {
        await delay(delayBetweenBatches);
      }
    }

    // Phase 3: Also fetch from list endpoints for variety
    onProgress?.({ phase: 'lists', current: 0, total: 3, message: 'Fetching curated lists...' });

    const listEndpoints = ['trending', 'latest_added', 'latest_updated'];
    const listResults = await Promise.all(
      listEndpoints.map(endpoint => fetchFromListEndpoint(apiKey, game, endpoint))
    );

    for (const result of listResults) {
      if (result.rateLimit) latestRateLimit = result.rateLimit;
      for (const mod of result.mods) {
        if (!seenIds.has(mod.mod_id)) {
          seenIds.add(mod.mod_id);
          allMods.push(mod);
        }
      }
    }

    onProgress?.({ phase: 'complete', current: allMods.length, total: allMods.length, message: `Loaded ${allMods.length} mods` });

    // Final shuffle
    const shuffledMods = shuffleArray(allMods);
    
    console.log(`Total: ${shuffledMods.length} unique valid mods fetched`);

    return {
      mods: shuffledMods,
      rateLimit: latestRateLimit,
    };
  } catch (error) {
    console.error("Failed to fetch mods:", error);
    throw error;
  }
};

/**
 * Quick fetch for small batches (original behavior)
 * Used for quick refreshes when user needs more mods
 */
export const fetchMods = async (
  apiKey: string,
  game: Game,
  mode: 'random' | 'lite' = 'random'
): Promise<FetchModsResponse> => {
  // Use bulk fetch with smaller count for "random" mode
  if (mode === 'random') {
    return fetchModsBulk(apiKey, game, 15);
  }

  // Lite mode: just fetch from list endpoints
  if (!apiKey) {
    await delay(1500);
    return {
      mods: MOCK_MODS.map(m => ({
        ...m,
        mod_id: m.mod_id + Math.floor(Math.random() * 10000),
        domain_name: game,
      })),
      rateLimit: null,
    };
  }

  const listEndpoints = ['trending', 'latest_added', 'latest_updated'];
  const allMods: Mod[] = [];
  const seenIds = new Set<number>();
  let latestRateLimit: RateLimitInfo | null = null;

  const results = await Promise.all(
    listEndpoints.map(endpoint => fetchFromListEndpoint(apiKey, game, endpoint))
  );

  for (const result of results) {
    if (result.rateLimit) latestRateLimit = result.rateLimit;
    for (const mod of result.mods) {
      if (!seenIds.has(mod.mod_id)) {
        seenIds.add(mod.mod_id);
        allMods.push(mod);
      }
    }
  }

  return {
    mods: shuffleArray(allMods),
    rateLimit: latestRateLimit,
  };
};

/**
 * Validates an API key by making a lightweight request
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch(`${NEXUS_API_BASE}/users/validate.json`, {
      headers: getHeaders(apiKey),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Gets user info including premium status.
 * Exported for use by external callers - can be used to display user info
 * in the UI or adjust behavior based on premium status (e.g., rate limits).
 * 
 * @param apiKey - Nexus Mods API key
 * @returns User info object with isPremium and name, or null if request fails
 */
export const getUserInfo = async (apiKey: string): Promise<{ isPremium: boolean; name: string } | null> => {
  try {
    const response = await fetch(`${NEXUS_API_BASE}/users/validate.json`, {
      headers: getHeaders(apiKey),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      isPremium: data.is_premium || false,
      name: data.name || 'User',
    };
  } catch {
    return null;
  }
};
