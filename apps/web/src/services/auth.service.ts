import { API_URL } from '../utils/api';
import { ProfileResponse } from './types';

/**
 * Get user profile from the backend
 * @param token - Authentication token
 * @returns Profile data or throws error
 */
export async function getProfile(token: string): Promise<ProfileResponse> {
  const response = await fetch(`${API_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
  });

  if (response.ok || response.status === 304) {
    // For 304 responses, re-fetch with cache-busting
    if (response.status === 304) {
      const freshResponse = await fetch(`${API_URL}/auth/profile?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      if (freshResponse.ok) {
        return await freshResponse.json();
      } else {
        throw new Error('Failed to fetch profile');
      }
    } else {
      return await response.json();
    }
  } else {
    throw new Error(`Failed to get profile: ${response.status}`);
  }
}
