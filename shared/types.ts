export interface PodcastConfig {
  id: string;
  feedUrl: string;
  subject: string;
  name?: string;
}

export interface PodcastSummary {
  id: string;
  title: string;
  subject: string;
  image?: string;
  description: string;
  lastUpdated?: string;
  error?: boolean;
}

export interface Episode {
  id: string;
  title: string;
  date: string;
  duration?: number;
  audioUrl: string;
  description: string;
  image?: string;
  transcriptUrl?: string;
}

export interface PodcastDetail extends PodcastSummary {
  episodes: Episode[];
}

export interface ParsedFeed {
  title: string;
  description: string;
  image?: string;
  lastUpdated?: string;
  episodes: Episode[];
}

export const THEMES = ['light', 'cream', 'dark', 'navy', 'green', 'contrast'] as const;
export type Theme = (typeof THEMES)[number];
export type TextSize = 0 | 1 | 2;
export type Grouping = 'all' | 'subject';
export type SortKey = 'name' | 'updated';

export interface Progress {
  podcastId: string;
  episodeId: string;
  podcastTitle: string;
  title: string;
  image?: string;
  position: number;
  duration: number;
  updatedAt: number;
}

export interface UserSettings {
  theme: Theme;
  textSize: TextSize;
  grouping: Grouping;
  sort: SortKey;
}

export interface UserData {
  settings: UserSettings;
  favorites: string[];
  progress: Record<string, Progress>;
}

export interface UserDataResponse {
  data: UserData | null;
  rev: number;
}
