import { api } from './api';
import { AuthResponse, User } from '../types';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  if (__DEV__) {
    console.log('[Auth Service] Starting login request to /auth/login');
  }
  
  try {
    const response = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
    
    // Debug logging
    if (__DEV__) {
      console.log('[Auth Service] Response received:', {
        hasUser: !!response.user,
        hasToken: !!response.token,
        tokenLength: response.token?.length || 0,
        tokenPreview: response.token ? `${response.token.substring(0, 20)}...` : 'none'
      });
    }
    
    if (!response.token) {
      console.error('[Auth Service] No token in response!', response);
      throw new Error('Login response missing token');
    }
    
    // Store token for future requests (api.ts will automatically use it)
    await api.setToken(response.token);
    
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login request failed';
    console.error('[Auth Service] Login request failed:', {
      message,
      endpoint: '/auth/login',
    });
    throw error instanceof Error ? error : new Error(message);
  }
}

export async function signupPrincipal(data: {
  email: string;
  password: string;
  full_name: string;
  school_name: string;
  school_address?: string;
  contact_phone?: string;
  contact_email?: string;
}): Promise<AuthResponse> {
  const response = await api.post<{ user: User; token: string }>('/auth/signup-principal', data);
  await api.setToken(response.token);
  return response;
}

export async function loginUsername(data: {
  username: string;
  password: string;
  join_code?: string;
  registration_number?: string;
}): Promise<AuthResponse> {
  if (__DEV__) {
    console.log('[Auth Service] Starting username login request to /auth/login-username');
  }
  
  try {
    const response = await api.post<{ user: User; token: string; session?: any }>('/auth/login-username', data);
    
    // Debug logging
    if (__DEV__) {
      console.log('[Auth Service] Username login response received:', {
        hasUser: !!response.user,
        hasToken: !!response.token,
        tokenLength: response.token?.length || 0,
      });
    }
    
    if (!response.token) {
      console.error('[Auth Service] No token in username login response!', response);
      throw new Error('Login response missing token');
    }
    
    // Store token for future requests (api.ts will automatically use it)
    await api.setToken(response.token);
    
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Username login request failed';
    console.error('[Auth Service] Username login request failed:', {
      message,
      endpoint: '/auth/login-username',
    });
    throw error instanceof Error ? error : new Error(message);
  }
}

export async function signupJoin(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'clerk' | 'teacher' | 'student' | 'parent';
  join_code: string;
  roll_number?: string;
  child_student_id?: string;
}): Promise<AuthResponse> {
  const response = await api.post<{ user: User; token: string }>('/auth/signup-join', data);
  await api.setToken(response.token);
  return response;
}
