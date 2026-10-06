import { describe, expect, it } from 'vitest';
import { parseDuration, parseFeed } from './parseFeed';
import { transcriptToParagraphs } from './transcript';

const xml = `<?xml version="1.0"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" version="2.0"><channel>
<title>Demo</title><description>&lt;p&gt;About&lt;/p&gt;</description>
<itunes:image href="https://img.example/a.jpg"/>
<item><title>Old</title><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate><guid>1</guid>
<enclosure url="https://a.example/1.mp3" type="audio/mpeg"/><itunes:duration>1:02:03</itunes:duration></item>
<item><title>New</title><pubDate>Mon, 01 Jul 2024 10:00:00 GMT</pubDate><guid>2</guid>
<enclosure url="https://a.example/2.mp3" type="audio/mpeg"/><podcast:transcript url="https://t.example/2.vtt" type="text/vtt"/></item>
<item><title>No audio</title><pubDate>Mon, 01 Jul 2024 10:00:00 GMT</pubDate></item>
</channel></rss>`;

describe('parseFeed', () => {
  it('parses, filters and sorts newest first', () => {
    const f = parseFeed(xml);
    expect(f.title).toBe('Demo');
    expect(f.description).toBe('About');
    expect(f.image).toBe('https://img.example/a.jpg');
    expect(f.episodes.map((e) => e.title)).toEqual(['New', 'Old']);
    expect(f.episodes[1].duration).toBe(3723);
    expect(f.episodes[0].transcriptUrl).toBe('https://t.example/2.vtt');
    expect(f.lastUpdated).toBe('2024-07-01T10:00:00.000Z');
  });
  it('rejects non-podcast xml', () => {
    expect(() => parseFeed('<html></html>')).toThrow();
  });
  it('parses durations', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('x')).toBeUndefined();
  });
});

describe('transcriptToParagraphs', () => {
  it('strips VTT timing', () => {
    const out = transcriptToParagraphs('WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nHello there\n\n2\n00:00:02.000 --> 00:00:04.000\nGeneral Kenobi');
    expect(out).toEqual(['Hello there General Kenobi']);
  });
  it('handles html', () => {
    expect(transcriptToParagraphs('<p>One</p><p>Two &amp; three</p>')).toEqual(['One', 'Two & three']);
  });
});
