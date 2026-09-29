import { env } from '../config/env';
import { session } from './session';
import type { ApiErrorBody, AuthResponse } from './types';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, public readonly details?: Record<string, string[]>) { super(status === 429 ? 'Too many requests. Please try again shortly.' : 'Request failed. Please try again.'); }
}
type Options = Omit<RequestInit, 'body'> & { body?: unknown; retry?: boolean; timeoutMs?: number };

async function parse(response: Response): Promise<unknown> { const text = await response.text(); if (!text) return undefined; try { return JSON.parse(text) as unknown; } catch { return text; } }
async function refresh(): Promise<boolean> {
  const refreshToken = session.refreshToken(); if (!refreshToken) return false;
  const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  if (!response.ok) return false;
  session.save(await response.json() as AuthResponse); return true;
}
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { body, retry = true, timeoutMs = 12_000, headers, ...init } = options;
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = session.accessToken();
    const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401 && retry && await refresh()) return api<T>(path, { ...options, retry: false });
    const payload = await parse(response);
    if (!response.ok) { if (response.status === 401) session.clear(); const body = (payload ?? {}) as ApiErrorBody; const error = body.error ?? body; throw new ApiError(response.status, error.code, error.details); }
    return payload as T;
  } catch (error) { if (error instanceof ApiError) throw error; if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(0, 'TIMEOUT'); throw new ApiError(0, 'NETWORK_ERROR'); }
  finally { window.clearTimeout(timer); }
}
export const query = (params: Record<string, string | number | undefined>) => { const value = new URLSearchParams(); Object.entries(params).forEach(([key, item]) => { if (item !== undefined) value.set(key, String(item)); }); const result = value.toString(); return result ? `?${result}` : ''; };
