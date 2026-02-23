import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is required. Set it in eas.json build profile or .env file.');
}

if (__DEV__) {
  console.log('[API] Configuration loaded:', {
    API_BASE_URL,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const baseUrl = (API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token?.trim()) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    if (__DEV__) {
      console.log('[API] Request:', url, { method: options.method || 'GET' });
    }
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout: Server did not respond within 30 seconds')), 30000);
    });
    response = await Promise.race([
      fetch(url, { ...options, headers }),
      timeoutPromise,
    ]);
    if (__DEV__) {
      console.log('[API] Response:', { status: response.status });
    }
  } catch (networkError: unknown) {
    const error = networkError as Error;
    const maxRetries = 2;
    if (retryCount < maxRetries) {
      await sleep(300 + retryCount * 100);
      return apiRequest<T>(path, options, retryCount + 1);
    }
    throw new Error(`Network error: ${error.message || 'Unable to connect to server'}`);
  }

  if (response.status === 401) {
    throw new Error('Authentication required. Please log in again.');
  }

  if (!response.ok) {
    let body: { error?: string; message?: string };
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : { error: `HTTP ${response.status}` };
    } catch {
      body = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` };
    }
    throw new Error(body.error || body.message || `HTTP ${response.status}`);
  }

  try {
    const text = await response.text();
    if (!text) throw new Error('Empty response from server');
    return JSON.parse(text) as T;
  } catch (parseError: unknown) {
    const err = parseError as Error;
    throw new Error(`Invalid response: ${err.message || 'Could not parse server response'}`);
  }
}

export const api = {
  get: <T>(path: string): Promise<T> => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    apiRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    apiRequest<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    apiRequest<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string): Promise<T> => apiRequest<T>(path, { method: 'DELETE' }),
  request: <T>(path: string, options?: RequestInit): Promise<T> => apiRequest<T>(path, options ?? {}),
};
