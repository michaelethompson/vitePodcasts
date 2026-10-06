import { THEMES, type Progress, type UserData } from '../shared/types';

const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const MAX_PROGRESS = 200;

function parseProgress(v: any): Progress | null {
  if (!v || typeof v !== 'object') return null;
  if (!str(v.podcastId, 100) || !str(v.episodeId, 100) || !str(v.podcastTitle, 500) || !str(v.title, 500)) return null;
  if (!num(v.position) || !num(v.duration) || !num(v.updatedAt)) return null;
  const image = typeof v.image === 'string' && v.image.length <= 2000 && /^https?:\/\//i.test(v.image) ? v.image : undefined;
  return {
    podcastId: v.podcastId,
    episodeId: v.episodeId,
    podcastTitle: v.podcastTitle,
    title: v.title,
    ...(image ? { image } : {}),
    position: v.position,
    duration: v.duration,
    updatedAt: v.updatedAt,
  };
}

// Returns a clean copy of the data, or null when the shape is not valid.
export function parseUserData(raw: any): UserData | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw.settings;
  if (!s || !THEMES.includes(s.theme) || ![0, 1, 2].includes(s.textSize)) return null;
  if (!['all', 'subject'].includes(s.grouping) || !['name', 'updated'].includes(s.sort)) return null;
  if (!Array.isArray(raw.favorites) || raw.favorites.length > 500 || !raw.favorites.every((f: unknown) => str(f, 100))) return null;
  if (!raw.progress || typeof raw.progress !== 'object' || Array.isArray(raw.progress)) return null;
  const entries = Object.entries(raw.progress);
  if (entries.length > MAX_PROGRESS * 2) return null;
  const progress: Record<string, Progress> = {};
  for (const [key, value] of entries) {
    const p = parseProgress(value);
    if (!p || key !== `${p.podcastId}/${p.episodeId}`) return null;
    progress[key] = p;
  }
  return {
    settings: { theme: s.theme, textSize: s.textSize, grouping: s.grouping, sort: s.sort },
    favorites: [...new Set<string>(raw.favorites)],
    progress,
  };
}

// Keeps the most recently updated entry per episode, capped to the newest MAX_PROGRESS.
export function mergeProgress(a: Record<string, Progress>, b: Record<string, Progress>): Record<string, Progress> {
  const merged: Record<string, Progress> = { ...a };
  for (const [k, v] of Object.entries(b)) if (!merged[k] || merged[k].updatedAt < v.updatedAt) merged[k] = v;
  return Object.fromEntries(
    Object.entries(merged)
      .sort(([, x], [, y]) => y.updatedAt - x.updatedAt)
      .slice(0, MAX_PROGRESS),
  );
}
