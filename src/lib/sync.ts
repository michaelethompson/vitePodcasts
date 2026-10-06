import type { Progress, UserData } from '../../shared/types';

export interface SyncState {
  user: string;
  rev: number;
  dirty: boolean;
}

const KEY = 'sync-state';

export function readSyncState(): SyncState | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}
export const writeSyncState = (s: SyncState) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSyncState = () => localStorage.removeItem(KEY);

// Canonical string used to tell whether local state differs from what the server holds.
export function serialize(d: UserData): string {
  return JSON.stringify([
    [d.settings.theme, d.settings.textSize, d.settings.grouping, d.settings.sort],
    d.favorites,
    Object.keys(d.progress)
      .sort()
      .map((k) => {
        const e = d.progress[k];
        return [k, e.podcastId, e.episodeId, e.podcastTitle, e.title, e.image ?? null, e.position, e.duration, e.updatedAt];
      }),
  ]);
}

export function mergeProgress(a: Record<string, Progress>, b: Record<string, Progress>): Record<string, Progress> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || out[k].updatedAt < v.updatedAt) out[k] = v;
  return out;
}

export const unionFavorites = (a: string[], b: string[]) => [...new Set([...a, ...b])];

export type MergeCase = 'new-account' | 'new-device' | 'local-changes' | 'server-wins';

// Decides how local and server data combine after signing in or returning to the app.
export function mergeData(local: UserData, server: UserData | null, state: SyncState | null, user: string): UserData {
  if (!server) return local;
  const progress = mergeProgress(server.progress, local.progress);
  if (state?.user !== user) {
    return { settings: server.settings, favorites: unionFavorites(server.favorites, local.favorites), progress };
  }
  if (state.dirty) return { settings: local.settings, favorites: local.favorites, progress };
  return { settings: server.settings, favorites: server.favorites, progress };
}
