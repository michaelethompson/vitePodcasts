import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Episode } from '../../shared/types';
import { progressKey, useLibrary } from './LibraryContext';

export interface NowPlaying {
  podcastId: string;
  podcastTitle: string;
  image?: string;
  episode: Episode;
}

interface PlayerState {
  current: NowPlaying | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  time: number;
  duration: number;
  rate: number;
  volume: number;
  sleepMinutes: number | null;
  sleepEndsAt: number | null;
  load: (np: NowPlaying) => void;
  toggle: () => void;
  seekTo: (s: number) => void;
  skip: (delta: number) => void;
  setRate: (r: number) => void;
  setVolume: (v: number) => void;
  setSleep: (minutes: number | null) => void;
}

const Ctx = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { progress, saveProgress } = useLibrary();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();

  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);

  const currentRef = useRef(current);
  currentRef.current = current;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const lastSaved = useRef(0);

  const persist = useCallback(() => {
    const a = audioRef.current;
    const c = currentRef.current;
    if (!a || !c || !Number.isFinite(a.currentTime)) return;
    saveProgress({
      podcastId: c.podcastId,
      episodeId: c.episode.id,
      podcastTitle: c.podcastTitle,
      title: c.episode.title,
      image: c.episode.image ?? c.image,
      position: a.currentTime,
      duration: Number.isFinite(a.duration) ? a.duration : (c.episode.duration ?? 0),
      updatedAt: Date.now(),
    });
  }, [saveProgress]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const on = <K extends keyof HTMLMediaElementEventMap>(n: K, fn: () => void) => {
      a.addEventListener(n, fn);
      return () => a.removeEventListener(n, fn);
    };
    const offs = [
      on('play', () => setPlaying(true)),
      on('pause', () => {
        setPlaying(false);
        persist();
      }),
      on('ended', () => {
        setPlaying(false);
        persist();
      }),
      on('waiting', () => setLoading(true)),
      on('canplay', () => setLoading(false)),
      on('playing', () => setLoading(false)),
      on('loadedmetadata', () => setDuration(Number.isFinite(a.duration) ? a.duration : 0)),
      on('durationchange', () => setDuration(Number.isFinite(a.duration) ? a.duration : 0)),
      on('timeupdate', () => {
        setTime(a.currentTime);
        if (!a.paused && Date.now() - lastSaved.current > 5000) {
          lastSaved.current = Date.now();
          persist();
        }
      }),
      on('error', () => {
        setLoading(false);
        setPlaying(false);
        setError('This episode could not be played. Please try again later.');
      }),
    ];
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    return () => {
      offs.forEach((f) => f());
      window.removeEventListener('pagehide', onHide);
    };
  }, [persist]);

  const load = useCallback(
    (np: NowPlaying) => {
      const a = audioRef.current;
      if (!a) return;
      const cur = currentRef.current;
      if (cur && cur.podcastId === np.podcastId && cur.episode.id === np.episode.id) return;
      if (cur) persist();
      const saved = progressRef.current[progressKey(np.podcastId, np.episode.id)];
      const start = saved && saved.duration - saved.position >= 30 ? saved.position : 0;
      setError(null);
      setCurrent(np);
      currentRef.current = np;
      setTime(start);
      setDuration(np.episode.duration ?? 0);
      a.src = np.episode.audioUrl;
      a.playbackRate = a.defaultPlaybackRate = rate;
      a.addEventListener(
        'loadedmetadata',
        () => {
          if (start > 0) a.currentTime = start;
        },
        { once: true },
      );
      a.load();
    },
    [persist, rate],
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !currentRef.current) return;
    if (a.paused) {
      setError(null);
      a.play().catch(() => setError('Playback could not start. Please try again.'));
    } else a.pause();
  }, []);

  const seekTo = useCallback((s: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(s, Number.isFinite(a.duration) ? a.duration : s));
    setTime(a.currentTime);
  }, []);

  const skip = useCallback((d: number) => seekTo((audioRef.current?.currentTime ?? 0) + d), [seekTo]);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = audioRef.current.defaultPlaybackRate = r;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const setSleep = useCallback((m: number | null) => {
    setSleepMinutes(m);
    setSleepEndsAt(m ? Date.now() + m * 60000 : null);
  }, []);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const t = setTimeout(() => {
      audioRef.current?.pause();
      setSleepMinutes(null);
      setSleepEndsAt(null);
    }, Math.max(0, sleepEndsAt - Date.now()));
    return () => clearTimeout(t);
  }, [sleepEndsAt]);

  // Lock screen / media key controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    const art = current.episode.image ?? current.image;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.episode.title,
      artist: current.podcastTitle,
      artwork: art ? [{ src: art }] : [],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', toggle],
      ['pause', toggle],
      ['seekbackward', () => skip(-30)],
      ['seekforward', () => skip(30)],
      ['seekto', (d) => d.seekTime !== undefined && seekTo(d.seekTime)],
    ];
    handlers.forEach(([k, h]) => {
      try {
        navigator.mediaSession.setActionHandler(k, h);
      } catch {
        /* unsupported action */
      }
    });
  }, [current, toggle, skip, seekTo]);

  const value = useMemo<PlayerState>(
    () => ({
      current, playing, loading, error, time, duration, rate, volume, sleepMinutes, sleepEndsAt,
      load, toggle, seekTo, skip, setRate, setVolume, setSleep,
    }),
    [current, playing, loading, error, time, duration, rate, volume, sleepMinutes, sleepEndsAt, load, toggle, seekTo, skip, setRate, setVolume, setSleep],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error('PlayerProvider missing');
  return v;
}
