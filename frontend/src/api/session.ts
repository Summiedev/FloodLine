import type { AuthResponse, User } from './types';

const key = 'floodline.auth';
type Stored = Pick<AuthResponse, 'accessToken' | 'refreshToken' | 'user'>;

export const session = {
  get(): Stored | null { try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as Stored : null; } catch { return null; } },
  save(response: AuthResponse) { sessionStorage.setItem(key, JSON.stringify({ accessToken: response.accessToken, refreshToken: response.refreshToken, user: response.user })); },
  clear() { sessionStorage.removeItem(key); },
  accessToken() { return this.get()?.accessToken ?? null; },
  refreshToken() { return this.get()?.refreshToken ?? null; },
  updateUser(user: User) { const value = this.get(); if (value) sessionStorage.setItem(key, JSON.stringify({ ...value, user })); },
};
