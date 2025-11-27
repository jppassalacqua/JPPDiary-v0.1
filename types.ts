
declare global {
  const google: any;
  const L: any; // Leaflet
}

export type ThemeMode = 'system' | 'light' | 'dark' | 'high-contrast' | 'custom';

export interface CustomThemeColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
}

export type AiProvider = 'gemini' | 'local';

export interface AiConfig {
  provider: AiProvider;
  apiKey?: string; // For Gemini
  localUrl: string;   // e.g., "http://localhost:11434/v1"
  localModel: string; // e.g., "llama3", "mistral"
}

export interface UserPreferences {
  theme: ThemeMode;
  customColors?: CustomThemeColors;
  systemPrompt: string;
  language: string;
  useServerStorage?: boolean;
  serverUrl?: string;
  savedTags?: string[]; 
  // aiConfig removed from user preferences
  logRetentionDays?: number;
}

export interface SystemSettings {
    aiConfig: AiConfig;
}

export interface User {
  id: string;
  username: string;
  password?: string; 
  displayName: string;
  bio?: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
}

export enum Mood {
  Joyful = 'Joyful',
  Happy = 'Happy',
  Neutral = 'Neutral',
  Sad = 'Sad',
  Anxious = 'Anxious',
  Angry = 'Angry',
  Reflective = 'Reflective',
  Tired = 'Tired'
}

export enum EntryMode {
  Manual = 'Manual',
  Chat = 'Chat',
  Interview = 'Interview'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sentimentScore?: number;
}

export type CatalogItemType = 'Person' | 'Location' | 'Event' | 'Concept' | 'Book' | 'Movie' | 'Other';

export interface EntityReference {
    name: string;
    type: CatalogItemType;
}

export interface AnalysisResult {
  sentimentScore: number; // -1 to 1
  mood: Mood;
  entities: EntityReference[]; // AI extracted entities
  manualTags?: string[]; // User defined tags
  summary: string;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  timestamp: number;
  content: string; 
  mode: EntryMode;
  analysis: AnalysisResult;
  location?: {
    lat: number;
    lng: number;
  };
  country?: string;
  city?: string;
  address?: string;
  image?: string; 
  images?: string[]; 
  audio?: string[]; 
}

export interface CatalogEntry {
  id: string;
  userId: string;
  sourceEntryId: string; 
  name: string;
  type: CatalogItemType;
  description: string;
  tags: string[];
  timestamp: number;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    source: string;
    message: string;
    data?: any;
}
