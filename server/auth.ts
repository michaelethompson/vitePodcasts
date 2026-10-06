import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

function loadSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Persisted so that sign-ins survive a restart of the server.
  const file = path.join(path.dirname(path.resolve(process.env.DATA_FILE ?? 'data/podcasts.json')), '.session-secret');
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    const secret = randomBytes(32).toString('hex');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

const SECRET = loadSecret();
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const USER_SESSION_MS = 90 * 24 * 60 * 60 * 1000;

const sign = (payload: string) => createHmac('sha256', SECRET).update(payload).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return !!expected && safeEqual(candidate, expected);
}

type Kind = 'admin' | 'user';

function issue(kind: Kind, subject: string, ttl: number): string {
  const payload = `${kind}.${subject}.${Date.now() + ttl}`;
  return `${payload}.${sign(payload)}`;
}

function verify(token: string, kind: Kind): string | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [k, subject, exp, sig] = parts;
  if (k !== kind || !(Number(exp) > Date.now())) return null;
  return safeEqual(sig, sign(`${k}.${subject}.${exp}`)) ? subject : null;
}

export const issueToken = () => issue('admin', '-', ADMIN_SESSION_MS);
export const issueUserToken = (userId: string) => issue('user', userId, USER_SESSION_MS);
export const verifyUserToken = (token: string) => verify(token, 'user');

const bearer = (req: Request) => (req.headers.authorization ?? '').replace(/^Bearer /, '');

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (verify(bearer(req), 'admin')) return next();
  res.status(401).json({ error: 'Please sign in again.' });
}

export function tokenFrom(req: Request): string {
  return bearer(req);
}

export function rateLimit(max: number, windowMs: number, message: string) {
  const attempts = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    if (attempts.size > 1000) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
    const rec = attempts.get(key);
    if (!rec || rec.reset < now) attempts.set(key, { n: 1, reset: now + windowMs });
    else if (++rec.n > max) return res.status(429).json({ error: message });
    next();
  };
}

export const loginRateLimit = rateLimit(10, 15 * 60 * 1000, 'Too many attempts. Try again in 15 minutes.');
export const userAuthRateLimit = rateLimit(30, 15 * 60 * 1000, 'Too many attempts. Please wait 15 minutes and try again.');
export const registerRateLimit = rateLimit(10, 60 * 60 * 1000, 'Too many new accounts from this device. Please try again later.');
