export function formatDate(iso?: string, long = false): string {
  if (!iso) return 'Unknown date';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: long ? 'long' : 'short',
    day: 'numeric',
  });
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Spoken-friendly length such as "1 hour 5 minutes".
export function formatLength(seconds?: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m || !h) parts.push(`${m || 1} ${m === 1 || !m ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}
