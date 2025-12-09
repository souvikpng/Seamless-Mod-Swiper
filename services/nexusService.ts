import { NEXUS_API_BASE, MOCK_MODS } from '../constants';
import { Mod, Game } from '../types';

/**
 * Fetches mods for a specific game.
 * Uses the standard V1 REST API as it is the stable public endpoint.
 * GraphQL V2 is currently restricted/beta and not reliable for general use without specific access.
 */
export const fetchMods = async (
  apiKey: string,
  game: Game,
  sort: 'trending' | 'popular' | 'updated' = 'trending'
): Promise<Mod[]> => {
  if (!apiKey) {
    console.warn("No API Key provided, returning mocks for UI demo.");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Return unique mocks to prevent duplicates in a real scenario
    return MOCK_MODS.map(m => ({...m, mod_id: m.mod_id + Math.floor(Math.random() * 10000)}));
  }

  try {
    const response = await fetch(
      `${NEXUS_API_BASE}/games/${game}/mods/${sort}.json?limit=50`,
      {
        headers: {
          'apikey': apiKey,
          'Application-Name': 'Seamless Mod Swiper',
          'Application-Version': '1.0.0',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) throw new Error("Invalid API Key");
      throw new Error(`Nexus API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data as Mod[];
  } catch (error) {
    console.error("Failed to fetch mods:", error);
    throw error;
  }
};
