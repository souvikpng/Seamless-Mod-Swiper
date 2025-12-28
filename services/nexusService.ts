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
 * Parses rate limit headers from Nexus API response
 */
const parseRateLimitHeaders = (response: Response): RateLimitInfo | null => {
  const hourlyLimit = response.headers.get('x-rl-hourly-limit');
  const hourlyRemaining = response.headers.get('x-rl-hourly-remaining');
  const dailyLimit = response.headers.get('x-rl-daily-limit');
  const dailyRemaining = response.headers.get('x-rl-daily-remaining');

  if (hourlyRemaining && dailyRemaining) {
    return {
      hourlyLimit: parseInt(hourlyLimit || '50', 10),
      hourlyRemaining: parseInt(hourlyRemaining, 10),
      dailyLimit: parseInt(dailyLimit || '500', 10),
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
 * Main function to fetch mods with true randomness
 * 
 * Strategy:
 * 1. Get a large pool of mod IDs from the "updated in last month" endpoint (1 API call)
 * 2. Randomly select ~20 mod IDs from this pool
 * 3. Fetch individual mod details for each (20 API calls, done in batches)
 * 4. Filter out invalid mods
 * 5. Also fetch from trending/latest for baseline variety (2 API calls)
 * 
 * Total: ~23 API calls per fetch, but gets truly random mods
 * 
 * Alternative "lite" mode uses just the list endpoints for fewer API calls
 */
export const fetchMods = async (
  apiKey: string,
  game: Game,
  mode: 'random' | 'lite' = 'random'
): Promise<FetchModsResponse> => {
  if (!apiKey) {
    console.warn("No API Key provided, returning mocks for UI demo.");
    await new Promise(resolve => setTimeout(resolve, 1500));
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
    const seenIds = new Set<number>();

    if (mode === 'random') {
      // RANDOM MODE: Get mod IDs from updated list, then fetch random ones individually
      
      // Step 1: Get the pool of recently updated mod IDs (1 API call)
      console.log('Fetching mod ID pool...');
      const { modIds, rateLimit: poolRateLimit } = await fetchUpdatedModIds(apiKey, game, '1m');
      if (poolRateLimit) latestRateLimit = poolRateLimit;
      
      console.log(`Got ${modIds.length} mod IDs in pool`);
      
      // Step 2: Randomly select mod IDs to fetch (avoid already seen)
      const shuffledIds = shuffleArray(modIds);
      const idsToFetch = shuffledIds.slice(0, 15); // Fetch 15 random mods
      
      // Step 3: Fetch individual mod details in parallel (batched to avoid overwhelming)
      console.log(`Fetching details for ${idsToFetch.length} random mods...`);
      
      // Batch into groups of 5 to be respectful of rate limits
      for (let i = 0; i < idsToFetch.length; i += 5) {
        const batch = idsToFetch.slice(i, i + 5);
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
      }
      
      console.log(`Got ${allMods.length} valid random mods`);
    }

    // Also fetch from list endpoints for additional variety (both modes)
    // These are "curated" lists that ensure we have some good content
    const listEndpoints = mode === 'lite' 
      ? ['trending', 'latest_added', 'latest_updated']
      : ['trending', 'latest_added']; // In random mode, just add trending + latest for baseline
    
    console.log(`Fetching from list endpoints: ${listEndpoints.join(', ')}`);
    
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

    // Final shuffle for randomness
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
