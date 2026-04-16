import { API_URL } from '../utils/api';
import { supabase } from '../utils/supabase';

function isAuthRoute(path: string): boolean {
  return path.startsWith('/auth/');
}

async function resolveAccessToken(tokenOverride?: string): Promise<string | null> {
  const override = (tokenOverride ?? '').trim();
  if (override && override !== 'undefined' && override !== 'null') return override;

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Authenticated fetch helper for backend APIs.
 *
 * - Always attaches `Authorization: Bearer <token>` for non-auth routes.
 * - Refuses to send protected requests if token is missing.
 * - Dev-only logs when token is missing.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${normalizedPath}`;

  const requireAuth = !isAuthRoute(normalizedPath);
  const token = await resolveAccessToken(tokenOverride);

  if (import.meta.env.DEV) {
    // Keep logs minimal; avoid leaking tokens.
    // eslint-disable-next-line no-console
    console.debug('[apiFetch] token?', !!token, normalizedPath);
  }

  if (requireAuth && !token) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[apiFetch] Missing token, aborting request:', normalizedPath);
    }
    throw new Error('Missing bearer token');
  }

  const headers = new Headers(options.headers ?? {});
  // Default JSON content-type when caller provided a body but no explicit content-type.
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, headers });
}

