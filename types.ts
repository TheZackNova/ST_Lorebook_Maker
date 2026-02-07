export interface LorebookEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: number;
  addMemo: boolean;
  order: number;
  position: number;
  disable: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: boolean;
  probability: number;
  useProbability: boolean;
  depth: number;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  sticky: number;
  cooldown: number;
  delay: number;
  displayIndex?: number;
  [key: string]: any;
}

export interface Lorebook {
  entries: Record<string, LorebookEntry>;
  [key: string]: any;
}

export type ApiProvider = 'gemini' | 'custom';
export type GenerationMode = 'brief' | 'detailed';

export interface ApiConfig {
  provider: ApiProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface LorebookTemplate {
  id: string;
  name: string;
  content: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}