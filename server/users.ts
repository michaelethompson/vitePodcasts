import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { UserData } from '../shared/types';
import { mergeProgress } from './userData';

export interface UserRecord {
  id: string;
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
  data: UserData | null;
  rev: number;
}

const FILE = path.resolve(process.env.USERS_FILE ?? 'data/users.json');
let queue: Promise<unknown> = Promise.resolve();

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );

async function readAll(): Promise<UserRecord[]> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, 'utf8'));
    return Array.isArray(raw.users) ? raw.users : [];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Serialises read-modify-write cycles and writes atomically.
function update<T>(fn: (users: UserRecord[]) => { users?: UserRecord[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const { users, result } = fn(await readAll());
    if (users) {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      const tmp = `${FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ users }, null, 2) + '\n', { mode: 0o600 });
      await fs.rename(tmp, FILE);
    }
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return { salt: salt.toString('hex'), hash: (await derive(password, salt)).toString('hex') };
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export async function createUser(username: string, password: string): Promise<UserRecord | 'taken'> {
  const { salt, hash } = await hashPassword(password);
  return update<UserRecord | 'taken'>((users) => {
    if (users.some((u) => same(u.username, username))) return { result: 'taken' as const };
    const rec: UserRecord = { id: randomUUID(), username, salt, hash, createdAt: new Date().toISOString(), data: null, rev: 0 };
    return { users: [...users, rec], result: rec };
  });
}

const DUMMY_SALT = randomBytes(16);

export async function verifyLogin(username: string, password: string): Promise<UserRecord | null> {
  const rec = (await readAll()).find((u) => same(u.username, username));
  // Hash even for unknown names so response time does not reveal which names exist.
  const key = await derive(password, rec ? Buffer.from(rec.salt, 'hex') : DUMMY_SALT);
  return rec && timingSafeEqual(key, Buffer.from(rec.hash, 'hex')) ? rec : null;
}

export async function getUser(id: string): Promise<UserRecord | undefined> {
  return (await readAll()).find((u) => u.id === id);
}

export async function listUsers() {
  return (await readAll()).map(({ id, username, createdAt }) => ({ id, username, createdAt }));
}

export async function setPassword(id: string, password: string): Promise<boolean> {
  const creds = await hashPassword(password);
  return update((users) => {
    if (!users.some((u) => u.id === id)) return { result: false };
    return { users: users.map((u) => (u.id === id ? { ...u, ...creds } : u)), result: true };
  });
}

export function removeUser(id: string): Promise<boolean> {
  return update((users) => {
    if (!users.some((u) => u.id === id)) return { result: false };
    return { users: users.filter((u) => u.id !== id), result: true };
  });
}

// Settings and favorites are last-write-wins; listening progress keeps the newest entry per episode.
export function saveData(id: string, incoming: UserData): Promise<number | null> {
  return update((users) => {
    const rec = users.find((u) => u.id === id);
    if (!rec) return { result: null };
    const rev = rec.rev + 1;
    const data: UserData = { ...incoming, progress: mergeProgress(rec.data?.progress ?? {}, incoming.progress) };
    return { users: users.map((u) => (u.id === id ? { ...u, data, rev } : u)), result: rev };
  });
}
