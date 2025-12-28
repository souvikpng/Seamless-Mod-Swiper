/**
 * Mod information from Nexus Mods API
 * Based on the V1 REST API response structure
 * Many fields are optional as they may not be present in all API responses
 */
export interface Mod {
  // Core identifiers (always present)
  mod_id: number;
  
  // Basic info (may be missing if mod is under moderation)
  name?: string;
  summary?: string;
  description?: string;
  
  // Media
  picture_url?: string;
  
  // Author info
  author?: string;
  uploaded_by?: string;
  
  // Version info
  version?: string;
  
  // Categorization
  category_id?: number;
  game_id?: number;
  domain_name: string;
  
  // Timestamps (unix seconds)
  created_timestamp?: number;
  updated_timestamp?: number;
  created_time?: string;
  updated_time?: string;
  
  // Stats
  endorsement_count?: number;
  mod_downloads?: number;
  mod_unique_downloads?: number;
  
  // Status
  status?: 'under_moderation' | 'published' | 'not_published' | 'publish_with_game' | 'removed' | 'wastebinned' | 'hidden';
  available?: boolean;
  contains_adult_content?: boolean;
  
  // Endorsement tracking
  allow_rating?: boolean;
}

export enum Game {
  CYBERPUNK = 'cyberpunk2077',
  RDR2 = 'reddeadredemption2',
  NEWVEGAS = 'newvegas',
  BG3 = 'baldursgate3',
  WITCHER3 = 'witcher3',
}

export interface GameTheme {
  primary: string;
  secondary: string;
  accent: string;
  font: string;
  uiStyle: 'cyberpunk' | 'fantasy' | 'western' | 'retro';
}

export interface UserProgress {
  seenIds: number[];
  approvedMods: Mod[];
}