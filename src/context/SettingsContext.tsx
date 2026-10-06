import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '../lib/useLocalStorage';

import type { Grouping, SortKey, TextSize, Theme } from '../../shared/types';
export type { Grouping, SortKey, TextSize, Theme };

interface Settings {
  theme: Theme;
  textSize: TextSize;
  grouping: Grouping;
  sort: SortKey;
  setTheme: (t: Theme) => void;
  setTextSize: (s: TextSize) => void;
  setGrouping: (g: Grouping) => void;
  setSort: (s: SortKey) => void;
}

const Ctx = createContext<Settings | null>(null);
const SIZES = ['20px', '24px', '28px'];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'cream');
  const [textSize, setTextSize] = useLocalStorage<TextSize>('text-size', 0);
  const [grouping, setGrouping] = useLocalStorage<Grouping>('grouping', 'all');
  const [sort, setSort] = useLocalStorage<SortKey>('sort', 'name');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.fontSize = SIZES[textSize] ?? SIZES[0];
  }, [theme, textSize]);

  return (
    <Ctx.Provider value={{ theme, textSize, grouping, sort, setTheme, setTextSize, setGrouping, setSort }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('SettingsProvider missing');
  return v;
}
