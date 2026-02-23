import type { Session } from '@supabase/supabase-js';
import { api } from './api';
import { supabase } from '../lib/supabase';
import type { AuthResponse, User } from '../types';

export interface LoginResponse {
  session: Session;
  user: unknown;
  profile: User;
}

export interface SignupPrincipalResponse {
  session: Session | null;
  user?: unknown;
  profile?: User;
  school?: { id: string; name: string; join_code: string };
  redirect?: string;
}

export interface SignupJoinResponse {
  user?: User;
  session?: Session | null;
  profile?: User;
}

async function setSessionAndReturn(session: Session, appUser: User): Promise<AuthResponse> {
  const { error } = await supabase.auth.setSession(session);
  if (error) {
    console.error('[Auth Service] setSession error:', error);
    throw new Error(error.message);
  }
  return { user: appUser, token: session.access_token };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<LoginResponse>('/auth/login', { email, password });
  if (!response.session) throw new Error('Login response missing session');
  if (!response.profile) throw new Error('Login response missing profile');
  return setSessionAndReturn(response.session, response.profile);
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
  const response = await api.post<SignupPrincipalResponse>('/auth/signup-principal', data);
  if (!response.profile) throw new Error('Signup response missing profile');
  if (response.session) return setSessionAndReturn(response.session, response.profile);
  return { user: response.profile, token: '' };
}

export async function loginUsername(data: {
  username: string;
  password: string;
  join_code?: string;
  registration_number?: string;
}): Promise<AuthResponse> {
  const response = await api.post<LoginResponse>('/auth/login-username', data);
  if (!response.session) throw new Error('Login response missing session');
  if (!response.profile) throw new Error('Login response missing profile');
  return setSessionAndReturn(response.session, response.profile);
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
  const response = await api.post<SignupJoinResponse>('/auth/signup-join', data);
  const appUser = response.profile ?? response.user;
  if (!appUser) throw new Error('Signup response missing user');
  if (response.session) return setSessionAndReturn(response.session, appUser as User);
  return { user: appUser as User, token: '' };
}
