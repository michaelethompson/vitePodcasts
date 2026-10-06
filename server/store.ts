import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PodcastConfig } from '../shared/types';

const FILE = path.resolve(process.env.DATA_FILE ?? 'data/podcasts.json');
let writeQueue: Promise<unknown> = Promise.resolve();

export async function readPodcasts(): Promise<PodcastConfig[]> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, 'utf8'));
    return Array.isArray(raw.podcasts) ? raw.podcasts : [];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Serialises read-modify-write cycles and writes atomically.
export function updatePodcasts(fn: (list: PodcastConfig[]) => PodcastConfig[]): Promise<PodcastConfig[]> {
  const run = writeQueue.then(async () => {
    const next = fn(await readPodcasts());
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ podcasts: next }, null, 2) + '\n');
    await fs.rename(tmp, FILE);
    return next;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}
