export interface Mod {
  mod_id: number;
  name: string;
  summary: string;
  description: string;
  picture_url: string;
  author: string;
  version: string;
  category_id: number;
  created_timestamp: number;
  updated_timestamp: number;
  endorsement_count: number;
  mod_downloads: number;
  domain_name: string;
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