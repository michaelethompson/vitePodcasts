import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { UserData } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { mergeData, readSyncState, serialize, writeSyncState } from '../lib/sync';
import { useAuth } from './AuthContext';
import { useLibrary } from './LibraryContext';
import { useSettings } from './SettingsContext';

const PUSH_DELAY_MS = 2000;
const PULL_THROTTLE_MS = 20000;

// Keeps this device's settings, favorites and listening progress in step with the signed-in account.
export function SyncManager() {
  const { username, signOut } = useAuth();
  const settings = useSettings();
  const library = useLibrary();

  const current = useMemo<UserData>(
    () => ({
      settings: { theme: settings.theme, textSize: settings.textSize, grouping: settings.grouping, sort: settings.sort },
      favorites: library.favorites,
      progress: library.progress,
    }),
    [settings.theme, settings.textSize, settings.grouping, settings.sort, library.favorites, library.progress],
  );
  const snapshot = useMemo(() => serialize(current), [current]);

  const live = useRef({ current, settings, library, username, signOut });
  live.current = { current, settings, library, username, signOut };
  const known = useRef('');
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPull = useRef(0);

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) live.current.signOut();
  }, []);

  const push = useCallback(
    async (data?: UserData, keepalive = false) => {
      clearTimeout(timer.current);
      const user = live.current.username;
      const body = data ?? live.current.current;
      const sent = serialize(body);
      if (!user || sent === known.current) return;
      try {
        const r = await api.pushData(body, keepalive);
        known.current = sent;
        writeSyncState({ user, rev: r.rev, dirty: serialize(live.current.current) !== sent });
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  const pull = useCallback(async () => {
    const user = live.current.username;
    if (!user) return;
    lastPull.current = Date.now();
    try {
      const r = await api.pullData();
      const merged = mergeData(live.current.current, r.data, readSyncState(), user);
      known.current = r.data ? serialize(r.data) : '';
      ready.current = true;
      const { settings: s, library: l } = live.current;
      s.setTheme(merged.settings.theme);
      s.setTextSize(merged.settings.textSize);
      s.setGrouping(merged.settings.grouping);
      s.setSort(merged.settings.sort);
      l.applyRemote({ favorites: merged.favorites, progress: merged.progress });
      writeSyncState({ user, rev: r.rev, dirty: false });
      if (serialize(merged) !== known.current) void push(merged);
    } catch (e) {
      fail(e);
    }
  }, [push, fail]);

  useEffect(() => {
    ready.current = false;
    known.current = '';
    clearTimeout(timer.current);
    if (username) void pull();
  }, [username, pull]);

  useEffect(() => {
    if (!username || !ready.current || snapshot === known.current) return;
    const st = readSyncState();
    if (st && !st.dirty) writeSyncState({ ...st, dirty: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void push(), PUSH_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [snapshot, username, push]);

  useEffect(() => {
    if (!username) return;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return void push(undefined, true);
      if (!ready.current || Date.now() - lastPull.current > PULL_THROTTLE_MS) void pull();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [username, pull, push]);

  return null;
}
