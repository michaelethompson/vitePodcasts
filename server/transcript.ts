function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Converts SRT, WebVTT, podcast-namespace JSON, HTML or plain text into readable paragraphs.
export function transcriptToParagraphs(raw: string): string[] {
  const body = raw.trim();
  if (!body) return [];

  if (body.startsWith('{')) {
    try {
      const segs: { body?: string; speaker?: string }[] = JSON.parse(body).segments ?? [];
      const out: string[] = [];
      let last: string | undefined;
      for (const s of segs) {
        if (!s.body) continue;
        const prefix = s.speaker && s.speaker !== last ? `${s.speaker}: ` : '';
        if (prefix || !out.length) out.push(prefix + s.body.trim());
        else out[out.length - 1] += ' ' + s.body.trim();
        last = s.speaker;
      }
      if (out.length) return out;
    } catch {
      /* fall through to text handling */
    }
  }

  let text = body;
  if (/<\/?(p|div|html|body|br)\b/i.test(text)) {
    text = text
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n\n')
      .replace(/<[^>]*>/g, '');
    text = decode(text);
  } else if (/-->/.test(text)) {
    text = text
      .replace(/^WEBVTT.*$/m, '')
      .split(/\r?\n/)
      .filter((l) => !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^(NOTE|STYLE)\b/.test(l))
      .join('\n')
      .replace(/<[^>]*>/g, '');
    return text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .reduce<string[]>((acc, line) => {
        // caption cues are short; merge them into ~600 character paragraphs
        if (acc.length && acc[acc.length - 1].length < 600) acc[acc.length - 1] += ' ' + line;
        else acc.push(line);
        return acc;
      }, []);
  }

  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
