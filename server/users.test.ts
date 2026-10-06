import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { UserData } from '../shared/types';
import { mergeProgress, parseUserData } from './userData';

const entry = (episodeId: string, updatedAt: number, position = 10) => ({
  podcastId: 'p', episodeId, podcastTitle: 'P', title: 'T', position, duration: 100, updatedAt,
});
const data = (over: Partial<UserData> = {}): UserData => ({
  settings: { theme: 'cream', textSize: 0, grouping: 'all', sort: 'name' },
  favorites: ['a'],
  progress: { 'p/1': entry('1', 5) },
  ...over,
});

describe('parseUserData', () => {
  it('accepts valid data and dedupes favorites', () => {
    expect(parseUserData(data({ favorites: ['a', 'a', 'b'] }))?.favorites).toEqual(['a', 'b']);
  });
  it('rejects bad shapes', () => {
    expect(parseUserData(null)).toBeNull();
    expect(parseUserData({ ...data(), settings: { theme: 'neon', textSize: 0, grouping: 'all', sort: 'name' } })).toBeNull();
    expect(parseUserData(data({ progress: { 'wrong/key': entry('1', 1) } }))).toBeNull();
    expect(parseUserData(data({ favorites: [5 as any] }))).toBeNull();
  });
  it('drops non-http images', () => {
    const d = data({ progress: { 'p/1': { ...entry('1', 1), image: 'javascript:alert(1)' } } });
    expect(parseUserData(d)?.progress['p/1'].image).toBeUndefined();
  });
});

describe('mergeProgress', () => {
  it('keeps the newest per episode', () => {
    const m = mergeProgress({ 'p/1': entry('1', 5, 10) }, { 'p/1': entry('1', 9, 50), 'p/2': entry('2', 1) });
    expect(m['p/1'].position).toBe(50);
    expect(Object.keys(m)).toEqual(['p/1', 'p/2']);
  });
});

describe('users store', () => {
  let users: typeof import('./users');
  beforeAll(async () => {
    process.env.USERS_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'users-')), 'users.json');
    users = await import('./users');
  });

  it('creates accounts with unique case-insensitive names and verifies passwords', async () => {
    const rec = await users.createUser('Grandma Jo', 'correct horse');
    expect(rec).not.toBe('taken');
    expect(await users.createUser('grandma jo', 'another pass')).toBe('taken');
    expect(await users.verifyLogin('GRANDMA JO', 'correct horse')).not.toBeNull();
    expect(await users.verifyLogin('Grandma Jo', 'wrong')).toBeNull();
    expect(await users.verifyLogin('nobody', 'x')).toBeNull();
  });

  it('saves data, merges progress, resets passwords and removes accounts', async () => {
    const rec = (await users.createUser('Bob', 'password1')) as Exclude<Awaited<ReturnType<typeof users.createUser>>, 'taken'>;
    expect(await users.saveData(rec.id, data())).toBe(1);
    expect(await users.saveData(rec.id, data({ progress: { 'p/2': entry('2', 7) } }))).toBe(2);
    const saved = await users.getUser(rec.id);
    expect(Object.keys(saved!.data!.progress).sort()).toEqual(['p/1', 'p/2']);
    expect(await users.setPassword(rec.id, 'newpassword')).toBe(true);
    expect(await users.verifyLogin('Bob', 'password1')).toBeNull();
    expect(await users.verifyLogin('Bob', 'newpassword')).not.toBeNull();
    expect(await users.removeUser(rec.id)).toBe(true);
    expect(await users.getUser(rec.id)).toBeUndefined();
  });
});
