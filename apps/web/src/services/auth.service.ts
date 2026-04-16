import { ProfileResponse } from './types';
import { apiFetch } from './apiClient';

/**
 * Get user profile from the backend
 * @param token - Authentication token
 * @returns Profile data or throws error
 */
export async function getProfile(token: string): Promise<ProfileResponse> {
  const response = await apiFetch('/auth/profile', {
    headers: {
      'Cache-Control': 'no-cache',
    },
  }, token);

  if (response.ok || response.status === 304) {
    // For 304 responses, re-fetch with cache-busting
    if (response.status === 304) {
      const freshResponse = await apiFetch(`/auth/profile?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }, token);
      if (freshResponse.ok) {
        return await freshResponse.json();
      } else {
        throw new Error('Failed to fetch profile');
      }
    } else {
      return await response.json();
    }
  } else {
    throw new Error('Failed to get profile');
  }
}
