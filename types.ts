
export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
}

export interface RetailTemplate {
  id: string;
  category: string;
  title: string;
  text: string;
  icon: string;
}

export interface StoreProfile {
  id: string;
  name: string;
  sector: string;
  lastUsed: number;
}

export interface HistoryItem {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  pitch: number;
  date: number;
  audioBlobUrl: string;
}

export enum GenerationStatus {
  IDLE = 'idle',
  REFINING = 'refining',
  GENERATING_AUDIO = 'generating_audio',
  SUCCESS = 'success',
  ERROR = 'error'
}
