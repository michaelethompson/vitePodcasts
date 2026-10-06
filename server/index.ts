import { existsSync } from 'node:fs';
import path from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');

import express from 'express';
import type { PodcastConfig, PodcastDetail, PodcastSummary } from '../shared/types';
import {
  checkPassword, issueToken, issueUserToken, loginRateLimit, registerRateLimit,
  requireAdmin, tokenFrom, userAuthRateLimit, verifyUserToken,
} from './auth';
import { download, forgetFeed, loadFeed } from './feeds';
import { transcriptToParagraphs } from './transcript';
import { readPodcasts, updatePodcasts } from './store';
import { parseUserData } from './userData';
import { createUser, getUser, listUsers, removeUser, saveData, setPassword, verifyLogin } from './users';

const app = express();
app.disable('x-powered-by');
app.use('/api/me', express.json({ limit: '300kb' }));
app.use(express.json({ limit: '20kb' }));

async function summarize(p: PodcastConfig): Promise<PodcastSummary> {
  try {
    const f = await loadFeed(p.feedUrl);
    return {
      id: p.id,
      title: p.name?.trim() || f.title,
      subject: p.subject,
      image: f.image,
      description: f.description,
      lastUpdated: f.lastUpdated,
    };
  } catch {
    return { id: p.id, title: p.name?.trim() || p.feedUrl, subject: p.subject, description: '', error: true };
  }
}

app.get('/api/podcasts', async (_req, res) => {
  res.json(await Promise.all((await readPodcasts()).map(summarize)));
});

app.get('/api/podcasts/:id', async (req, res) => {
  const p = (await readPodcasts()).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Podcast not found.' });
  try {
    const f = await loadFeed(p.feedUrl);
    const detail: PodcastDetail = { ...(await summarize(p)), episodes: f.episodes };
    res.json(detail);
  } catch {
    res.status(502).json({ error: 'This podcast could not be loaded right now.' });
  }
});

app.get('/api/podcasts/:id/episodes/:episodeId/transcript', async (req, res) => {
  const p = (await readPodcasts()).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Podcast not found.' });
  try {
    const ep = (await loadFeed(p.feedUrl)).episodes.find((e) => e.id === req.params.episodeId);
    if (!ep?.transcriptUrl) return res.status(404).json({ error: 'No transcript is available.' });
    const paragraphs = transcriptToParagraphs(await download(ep.transcriptUrl));
    if (!paragraphs.length) return res.status(404).json({ error: 'No transcript is available.' });
    res.json({ paragraphs: paragraphs.slice(0, 5000) });
  } catch {
    res.status(502).json({ error: 'The transcript could not be loaded.' });
  }
});

// ---- User accounts (optional; used to sync favorites, progress and settings) ----
function cleanUsername(v: unknown): string {
  return String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}
const USERNAME_OK = /^[\p{L}\p{N} ._-]{3,30}$/u;

function checkCredentials(body: any): { username: string; password: string } | string {
  const username = cleanUsername(body?.username);
  const password = String(body?.password ?? '');
  if (!USERNAME_OK.test(username)) return 'Your name must be 3 to 30 characters, using letters, numbers, spaces, dots, dashes or underscores.';
  if (password.length < 8) return 'Your password must be at least 8 characters long.';
  if (password.length > 200) return 'That password is too long.';
  return { username, password };
}

app.post('/api/auth/register', registerRateLimit, async (req, res) => {
  const c = checkCredentials(req.body);
  if (typeof c === 'string') return res.status(400).json({ error: c });
  const rec = await createUser(c.username, c.password);
  if (rec === 'taken') return res.status(409).json({ error: 'That name is already taken. Please choose another.' });
  res.status(201).json({ token: issueUserToken(rec.id), username: rec.username });
});

app.post('/api/auth/login', userAuthRateLimit, async (req, res) => {
  const rec = await verifyLogin(cleanUsername(req.body?.username), String(req.body?.password ?? '').slice(0, 200));
  if (!rec) return res.status(401).json({ error: 'Incorrect name or password.' });
  res.json({ token: issueUserToken(rec.id), username: rec.username });
});

const requireUser: express.RequestHandler = async (req, res, next) => {
  const id = verifyUserToken(tokenFrom(req));
  const user = id ? await getUser(id) : undefined;
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  res.locals.user = user;
  next();
};

app.get('/api/me/data', requireUser, (_req, res) => {
  const { data, rev } = res.locals.user;
  res.json({ data, rev });
});

app.put('/api/me/data', requireUser, async (req, res) => {
  const data = parseUserData(req.body);
  if (!data) return res.status(400).json({ error: 'Invalid data.' });
  const rev = await saveData(res.locals.user.id, data);
  if (rev === null) return res.status(401).json({ error: 'Please sign in again.' });
  res.json({ rev });
});

app.post('/api/me/password', userAuthRateLimit, requireUser, async (req, res) => {
  const next = checkCredentials({ username: res.locals.user.username, password: req.body?.next });
  if (typeof next === 'string') return res.status(400).json({ error: 'Your new password must be at least 8 characters long.' });
  if (!(await verifyLogin(res.locals.user.username, String(req.body?.current ?? '').slice(0, 200))))
    return res.status(400).json({ error: 'Your current password is not correct.' });
  await setPassword(res.locals.user.id, next.password);
  res.json({ ok: true });
});

// ---- Admin ----
const admin = express.Router();

app.post('/api/admin/login', loginRateLimit, (req, res) => {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORD is not set on the server.' });
  if (!checkPassword(String(req.body?.password ?? ''))) return res.status(401).json({ error: 'Incorrect password.' });
  res.json({ token: issueToken() });
});

function validate(body: any): { feedUrl: string; subject: string; name?: string } | string {
  const feedUrl = String(body?.feedUrl ?? '').trim();
  const subject = String(body?.subject ?? '').trim();
  const name = String(body?.name ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(feedUrl)) return 'Enter a feed address starting with http:// or https://';
  if (!subject) return 'Choose or enter a subject.';
  if (subject.length > 60 || name.length > 120) return 'Subject or name is too long.';
  return { feedUrl, subject, name: name || undefined };
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'podcast';

admin.get('/podcasts', async (_req, res) => {
  const list = await readPodcasts();
  const summaries = await Promise.all(list.map(summarize));
  res.json(list.map((p, i) => ({ ...p, title: summaries[i].title, error: summaries[i].error ?? false })));
});

admin.post('/preview', async (req, res) => {
  const v = validate({ subject: 'x', ...req.body });
  if (typeof v === 'string') return res.status(400).json({ error: v });
  try {
    const f = await loadFeed(v.feedUrl, { fresh: true });
    res.json({ title: f.title, image: f.image, episodeCount: f.episodes.length, lastUpdated: f.lastUpdated });
  } catch (e: any) {
    res.status(400).json({ error: `Could not read that feed: ${e.message}` });
  }
});

admin.post('/podcasts', async (req, res) => {
  const v = validate(req.body);
  if (typeof v === 'string') return res.status(400).json({ error: v });
  let title: string;
  try {
    title = (await loadFeed(v.feedUrl, { fresh: true })).title;
  } catch (e: any) {
    return res.status(400).json({ error: `Could not read that feed: ${e.message}` });
  }
  let created: PodcastConfig | undefined;
  let duplicate = false;
  await updatePodcasts((list) => {
    if (list.some((p) => p.feedUrl === v.feedUrl)) {
      duplicate = true;
      return list;
    }
    const base = slug(v.name ?? title);
    let id = base;
    for (let n = 2; list.some((p) => p.id === id); n++) id = `${base}-${n}`;
    created = { id, ...v };
    return [...list, created];
  });
  if (duplicate) return res.status(409).json({ error: 'That podcast is already in the list.' });
  res.status(201).json(created);
});

admin.put('/podcasts/:id', async (req, res) => {
  const v = validate(req.body);
  if (typeof v === 'string') return res.status(400).json({ error: v });
  try {
    await loadFeed(v.feedUrl, { fresh: true });
  } catch (e: any) {
    return res.status(400).json({ error: `Could not read that feed: ${e.message}` });
  }
  let found = false;
  await updatePodcasts((list) =>
    list.map((p) => {
      if (p.id !== req.params.id) return p;
      found = true;
      return { id: p.id, ...v };
    }),
  );
  if (!found) return res.status(404).json({ error: 'Podcast not found.' });
  res.json({ ok: true });
});

admin.delete('/podcasts/:id', async (req, res) => {
  let removed: PodcastConfig | undefined;
  await updatePodcasts((list) => {
    removed = list.find((p) => p.id === req.params.id);
    return list.filter((p) => p.id !== req.params.id);
  });
  if (!removed) return res.status(404).json({ error: 'Podcast not found.' });
  forgetFeed(removed.feedUrl);
  res.json({ ok: true });
});

admin.get('/users', async (_req, res) => res.json(await listUsers()));

admin.put('/users/:id/password', async (req, res) => {
  const password = String(req.body?.password ?? '');
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'The password must be at least 8 characters long.' });
  if (!(await setPassword(req.params.id, password))) return res.status(404).json({ error: 'Account not found.' });
  res.json({ ok: true });
});

admin.delete('/users/:id', async (req, res) => {
  if (!(await removeUser(req.params.id))) return res.status(404).json({ error: 'Account not found.' });
  res.json({ ok: true });
});

app.use('/api/admin', requireAdmin, admin);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built client in production.
const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*splat', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
