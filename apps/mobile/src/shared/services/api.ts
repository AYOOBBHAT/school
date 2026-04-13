import { supabase } from '../lib/supabase';
import { devLog } from '../utils/devLog';
import { secureRemoveItem } from '../lib/secureStorage';
import { Alert } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is required. Set it in eas.json build profile or .env file.');
}

if (__DEV__) {
  devLog('[API] Configuration loaded');
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
      devLog('[API] Request:', options.method || 'GET', normalizedPath);
    }
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout: Server did not respond within 30 seconds')), 30000);
    });
    response = await Promise.race([
      fetch(url, { ...options, headers }),
      timeoutPromise,
    ]);
    if (__DEV__) {
      devLog('[API] Response status:', response.status);
    }
  } catch (networkError: unknown) {
    const maxRetries = 2;
    if (retryCount < maxRetries) {
      await sleep(300 + retryCount * 100);
      return apiRequest<T>(path, options, retryCount + 1);
    }
    throw new Error('Something went wrong');
  }

  if (response.status === 401) {
    const isAuthRoute =
      normalizedPath.includes('/auth/login') ||
      normalizedPath.includes('/auth/register') ||
      normalizedPath.includes('/auth/forgot-password') ||
      normalizedPath.includes('/auth/reset-password');

    if (!isAuthRoute) {
      if ((globalThis as any).__handlingUnauthorized) {
        throw new Error('Authentication required. Please log in again.');
      }
      (globalThis as any).__handlingUnauthorized = true;

      Alert.alert('Session Expired', 'Please login again.');

      try {
        await secureRemoveItem('@school_saas:user');
        await supabase.auth.signOut();
      } catch {
        // ignore
      } finally {
        (globalThis as any).__handlingUnauthorized = false;
      }
    }

    throw new Error('Authentication required. Please log in again.');
  }

  if (!response.ok) {
    await response.text().catch(() => '');
    throw new Error('Something went wrong');
  }

  try {
    const text = await response.text();
    if (!text) throw new Error('Something went wrong');
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Something went wrong');
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
