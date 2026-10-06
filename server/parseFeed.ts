import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { Episode, ParsedFeed } from '../shared/types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: true,
});

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function text(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return text((v as Record<string, unknown>)['#text']);
  return String(v).trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDuration(v: unknown): number | undefined {
  const s = text(v);
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n)) || parts.length > 3) return undefined;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function safeUrl(v: unknown): string | undefined {
  const s = text(v);
  return /^https?:\/\//i.test(s) ? s : undefined;
}

function toIso(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) throw new Error('Not a valid podcast RSS feed');

  const image =
    safeUrl(channel['itunes:image']?.['@_href']) ?? safeUrl(channel.image?.url);

  const episodes: Episode[] = [];
  for (const item of asArray<any>(channel.item)) {
    const audioUrl = safeUrl(item.enclosure?.['@_url']);
    const date = toIso(item.pubDate);
    if (!audioUrl || !date) continue;
    const key = text(item.guid) || audioUrl;
    const transcript = asArray<any>(item['podcast:transcript']);
    const preferred =
      transcript.find((t) => /html|text\/plain/i.test(t?.['@_type'] ?? '')) ?? transcript[0];
    episodes.push({
      id: createHash('sha1').update(key).digest('hex').slice(0, 12),
      title: text(item.title) || 'Untitled episode',
      date,
      duration: parseDuration(item['itunes:duration']),
      audioUrl,
      description: stripHtml(text(item['content:encoded']) || text(item.description)).slice(0, 1500),
      image: safeUrl(item['itunes:image']?.['@_href']),
      transcriptUrl: safeUrl(preferred?.['@_url']),
    });
  }
  episodes.sort((a, b) => b.date.localeCompare(a.date));

  return {
    title: text(channel.title) || 'Untitled podcast',
    description: stripHtml(text(channel.description) || text(channel['itunes:summary'])).slice(0, 1000),
    image,
    lastUpdated: episodes[0]?.date ?? toIso(channel.lastBuildDate),
    episodes,
  };
}
