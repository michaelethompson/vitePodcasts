import dns from 'node:dns/promises';
import net from 'node:net';
import type { ParsedFeed } from '../shared/types';
import { parseFeed } from './parseFeed';

const TTL_MS = 15 * 60 * 1000;
const MAX_BYTES = 15 * 1024 * 1024;
const cache = new Map<string, { at: number; feed: ParsedFeed }>();

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Feed URL must be http or https');
  const addrs = await dns.lookup(url.hostname, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('Feed URL points to a private address');
  return url;
}

export async function download(raw: string): Promise<string> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'PodcastLibrary/1.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`Feed responded with status ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('Feed is too large');
    return buf.toString('utf8');
  }
  throw new Error('Too many redirects');
}

export async function loadFeed(feedUrl: string, { fresh = false } = {}): Promise<ParsedFeed> {
  const hit = cache.get(feedUrl);
  if (hit && !fresh && Date.now() - hit.at < TTL_MS) return hit.feed;
  try {
    const feed = parseFeed(await download(feedUrl));
    cache.set(feedUrl, { at: Date.now(), feed });
    return feed;
  } catch (err) {
    if (hit && !fresh) return hit.feed; // serve stale data if the source is down
    throw err;
  }
}

export function forgetFeed(feedUrl: string) {
  cache.delete(feedUrl);
}
