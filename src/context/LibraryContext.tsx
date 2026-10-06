import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../lib/useLocalStorage';

import type { Progress } from '../../shared/types';
export type { Progress };

interface Library {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  progress: Record<string, Progress>;
  saveProgress: (p: Progress) => void;
  applyRemote: (d: { favorites: string[]; progress: Record<string, Progress> }) => void;
}

const Ctx = createContext<Library | null>(null);
export const progressKey = (podcastId: string, episodeId: string) => `${podcastId}/${episodeId}`;
const MAX_ENTRIES = 200;

export function isFinished(p: Pick<Progress, 'position' | 'duration'>) {
  return p.duration > 0 && p.duration - p.position < 30;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useLocalStorage<string[]>('favorites', []);
  const [progress, setProgress] = useLocalStorage<Record<string, Progress>>('progress', {});

  const toggleFavorite = useCallback(
    (id: string) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
    [setFavorites],
  );

  const saveProgress = useCallback(
    (p: Progress) =>
      setProgress((prev) => {
        const next = { ...prev, [progressKey(p.podcastId, p.episodeId)]: p };
        const keys = Object.keys(next);
        if (keys.length > MAX_ENTRIES) {
          keys
            .sort((a, b) => next[a].updatedAt - next[b].updatedAt)
            .slice(0, keys.length - MAX_ENTRIES)
            .forEach((k) => delete next[k]);
        }
        return next;
      }),
    [setProgress],
  );

  const applyRemote = useCallback(
    (d: { favorites: string[]; progress: Record<string, Progress> }) => {
      setFavorites(d.favorites);
      setProgress(d.progress);
    },
    [setFavorites, setProgress],
  );

  return (
    <Ctx.Provider
      value={{ favorites, isFavorite: (id) => favorites.includes(id), toggleFavorite, progress, saveProgress, applyRemote }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLibrary() {
  const v = useContext(Ctx);
  if (!v) throw new Error('LibraryProvider missing');
  return v;
}
