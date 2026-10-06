import type { PodcastConfig, PodcastDetail, PodcastSummary, UserData, UserDataResponse } from '../../shared/types';

const TOKEN_KEY = 'admin-token';
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY);

const USER_TOKEN_KEY = 'user-token';
export const getUserToken = () => localStorage.getItem(USER_TOKEN_KEY);
export const setUserToken = (t: string | null) =>
  t ? localStorage.setItem(USER_TOKEN_KEY, t) : localStorage.removeItem(USER_TOKEN_KEY);

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}, auth: false | 'admin' | 'user' = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';
  const token = auth === 'admin' ? getToken() : auth === 'user' ? getUserToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError('Could not reach the server. Please check your connection.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong.', res.status);
  return data as T;
}

export type AdminPodcast = PodcastConfig & { title: string; error: boolean };
export interface FeedPreview {
  title: string;
  image?: string;
  episodeCount: number;
  lastUpdated?: string;
}
export interface AccountSummary {
  id: string;
  username: string;
  createdAt: string;
}
export type PodcastInput = Pick<PodcastConfig, 'feedUrl' | 'subject' | 'name'>;

export const api = {
  podcasts: () => request<PodcastSummary[]>('/api/podcasts'),
  podcast: (id: string) => request<PodcastDetail>(`/api/podcasts/${encodeURIComponent(id)}`),
  transcript: (id: string, ep: string) =>
    request<{ paragraphs: string[] }>(
      `/api/podcasts/${encodeURIComponent(id)}/episodes/${encodeURIComponent(ep)}/transcript`,
    ),
  login: (password: string) =>
    request<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  adminList: () => request<AdminPodcast[]>('/api/admin/podcasts', {}, 'admin'),
  adminPreview: (input: PodcastInput) =>
    request<FeedPreview>('/api/admin/preview', { method: 'POST', body: JSON.stringify(input) }, 'admin'),
  adminAdd: (input: PodcastInput) =>
    request<PodcastConfig>('/api/admin/podcasts', { method: 'POST', body: JSON.stringify(input) }, 'admin'),
  adminUpdate: (id: string, input: PodcastInput) =>
    request<{ ok: true }>(`/api/admin/podcasts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }, 'admin'),
  adminUsers: () => request<AccountSummary[]>('/api/admin/users', {}, 'admin'),
  adminSetUserPassword: (id: string, password: string) =>
    request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}/password`, { method: 'PUT', body: JSON.stringify({ password }) }, 'admin'),
  adminDeleteUser: (id: string) =>
    request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'admin'),
  register: (username: string, password: string) =>
    request<{ token: string; username: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  signIn: (username: string, password: string) =>
    request<{ token: string; username: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  pullData: () => request<UserDataResponse>('/api/me/data', {}, 'user'),
  pushData: (data: UserData, keepalive = false) =>
    request<{ rev: number }>('/api/me/data', { method: 'PUT', body: JSON.stringify(data), keepalive }, 'user'),
  changePassword: (current: string, next: string) =>
    request<{ ok: true }>('/api/me/password', { method: 'POST', body: JSON.stringify({ current, next }) }, 'user'),
  adminDelete: (id: string) =>
    request<{ ok: true }>(`/api/admin/podcasts/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'admin'),
};
