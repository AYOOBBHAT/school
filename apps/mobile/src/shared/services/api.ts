import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// API configuration - REQUIRED for production builds
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!API_BASE_URL) {
  const errorMsg = 'EXPO_PUBLIC_API_URL is required. Please set it in eas.json build profile or .env file.';
  if (__DEV__) {
    console.error('[API] Configuration Error:', errorMsg);
  }
  throw new Error(errorMsg);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const errorMsg = 'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required. Please set them in eas.json build profile or .env file.';
  if (__DEV__) {
    console.error('[API] Configuration Error:', errorMsg);
  }
  throw new Error(errorMsg);
}

// Log API configuration in development (never in production)
if (__DEV__) {
  console.log('[API] Configuration loaded:', {
    API_BASE_URL,
    SUPABASE_URL: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : 'NOT SET',
    hasSupabaseKey: !!SUPABASE_ANON_KEY,
  });
}
const TOKEN_KEY = '@school_saas:token';

// Initialize Supabase client if configured
let supabaseClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Get the current authentication token dynamically
 * Always fetches the latest token - never caches
 */
async function getToken(): Promise<string | null> {
  // If Supabase is configured, use it
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      return data.session?.access_token || null;
    } catch (error) {
      if (__DEV__) {
        console.error('[API] Error getting Supabase session:', error);
      }
      return null;
    }
  }

  // Fallback to AsyncStorage for non-Supabase setups
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error('[API] Error getting token from AsyncStorage:', error);
    }
    return null;
  }
}

/**
 * Refresh the authentication session
 * Returns new token or null if refresh fails
 */
async function refreshSession(): Promise<string | null> {
  if (!supabaseClient) {
    return null;
  }

  try {
    const { data } = await supabaseClient.auth.refreshSession();
    return data.session?.access_token || null;
  } catch (error) {
    if (__DEV__) {
      console.error('[API] Error refreshing session:', error);
    }
    return null;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Base API request function with automatic token refresh and retry logic
 * 
 * Features:
 * - Always fetches latest token dynamically (no caching)
 * - Auto-attaches Authorization and Content-Type headers
 * - Handles 401 with automatic session refresh and retry (once)
 * - Retries network errors up to 2 times with delay (300-500ms)
 * - Strong TypeScript typing
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retryCount = 0,
  isRetryAfterRefresh = false
): Promise<T> {
  // Normalize URL
  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  // Always fetch fresh token for this request
  const token = await getToken();

  // Build headers - auto-attach Content-Type and Authorization
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Make the request
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError: unknown) {
    // Network error - retry up to 2 times with delay
    const error = networkError as Error;
    const maxRetries = 2;
    
    if (retryCount < maxRetries) {
      const delay = 300 + (retryCount * 100); // 300ms, 400ms
      await sleep(delay);
      return apiRequest<T>(path, options, retryCount + 1, isRetryAfterRefresh);
    }

    // Max retries reached
    throw new Error(`Network error: ${error.message || 'Unable to connect to server'}`);
  }

  // Handle 401 Unauthorized - try to refresh and retry once
  if (response.status === 401 && !isRetryAfterRefresh && !path.startsWith('/auth/')) {
    const newToken = await refreshSession();
    
    if (newToken) {
      // Retry the request with new token (only once)
      return apiRequest<T>(path, options, retryCount, true);
    } else {
      // Refresh failed - throw authentication error
      throw new Error('Authentication required. Please log in again.');
    }
  }

  // Handle other error statuses
  if (!response.ok) {
    let error: { error?: string; message?: string };
    
    try {
      const errorText = await response.text();
      error = errorText ? JSON.parse(errorText) : { error: `HTTP ${response.status}` };
    } catch {
      error = { error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` };
    }

    const errorMessage = error.error || error.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  // Parse JSON response
  try {
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response from server');
    }
    return JSON.parse(text) as T;
  } catch (parseError: unknown) {
    const error = parseError as Error;
    throw new Error(`Invalid response format: ${error.message || 'Could not parse server response'}`);
  }
}

/**
 * Clean API helpers with strong typing
 * All services should use these instead of calling apiRequest directly
 */
export const api = {
  get: <T>(path: string): Promise<T> => {
    return apiRequest<T>(path, { method: 'GET' });
  },

  post: <T>(path: string, body?: unknown): Promise<T> => {
    return apiRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put: <T>(path: string, body?: unknown): Promise<T> => {
    return apiRequest<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch: <T>(path: string, body?: unknown): Promise<T> => {
    return apiRequest<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: <T>(path: string): Promise<T> => {
    return apiRequest<T>(path, { method: 'DELETE' });
  },

  /**
   * Raw request method for custom options
   * Use this only if you need to pass custom headers or other options
   */
  request: <T>(path: string, options?: RequestInit): Promise<T> => {
    return apiRequest<T>(path, options);
  },

  /**
   * Set token in AsyncStorage (for non-Supabase setups)
   * Note: With Supabase, tokens are managed automatically via getSession()
   */
  setToken: async (token: string | null): Promise<void> => {
    if (supabaseClient) {
      // With Supabase, tokens are managed by Supabase auth
      // This method is kept for backward compatibility but doesn't do anything
      if (__DEV__) {
        console.log('[API] setToken called but Supabase is configured - token managed by Supabase');
      }
      return;
    }

    // For non-Supabase setups, store token in AsyncStorage
    try {
      if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[API] Error setting token in AsyncStorage:', error);
      }
    }
  },

  /**
   * Get token (for backward compatibility)
   * Note: With Supabase, this will fetch from Supabase session
   */
  getToken: (): Promise<string | null> => {
    return getToken();
  },
};
