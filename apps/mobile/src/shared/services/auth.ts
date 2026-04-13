import * as authServiceFunctions from './auth.service';
import { supabase } from '../lib/supabase';
import { secureReadItem, secureRemoveItem, secureWriteItem } from '../lib/secureStorage';
import { devError } from '../utils/devLog';
import type { User, AuthResponse } from '../types';

const USER_KEY = '@school_saas:user';

export class AuthService {
  private currentUser: User | null = null;

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await authServiceFunctions.login(email, password);
    this.currentUser = response.user;
    try {
      await secureWriteItem(USER_KEY, JSON.stringify(response.user));
    } catch (storageError) {
      devError('[AuthService] SecureStore failed (non-blocking):', storageError);
    }
    return response;
  }

  async loginUsername(data: {
    username: string;
    password: string;
    join_code?: string;
    registration_number?: string;
  }): Promise<AuthResponse> {
    const response = await authServiceFunctions.loginUsername(data);
    this.currentUser = response.user;
    try {
      await secureWriteItem(USER_KEY, JSON.stringify(response.user));
    } catch (storageError) {
      devError('[AuthService] SecureStore failed (non-blocking):', storageError);
    }
    return response;
  }

  async signupPrincipal(data: {
    email: string;
    password: string;
    full_name: string;
    school_name: string;
    school_address?: string;
    contact_phone?: string;
    contact_email?: string;
  }): Promise<AuthResponse> {
    const response = await authServiceFunctions.signupPrincipal(data);
    this.currentUser = response.user;
    if (response.token) {
      try {
        await secureWriteItem(USER_KEY, JSON.stringify(response.user));
      } catch (storageError) {
        devError('[AuthService] SecureStore failed (non-blocking):', storageError);
      }
    }
    return response;
  }

  async signupJoin(data: {
    email: string;
    password: string;
    full_name: string;
    role: 'clerk' | 'teacher' | 'student' | 'parent';
    join_code: string;
    roll_number?: string;
    child_student_id?: string;
  }): Promise<AuthResponse> {
    const response = await authServiceFunctions.signupJoin(data);
    this.currentUser = response.user;
    if (response.token) {
      try {
        await secureWriteItem(USER_KEY, JSON.stringify(response.user));
      } catch (storageError) {
        devError('[AuthService] SecureStore failed (non-blocking):', storageError);
      }
    }
    return response;
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
    await secureRemoveItem(USER_KEY);
    this.currentUser = null;
  }

  async clearStoredAuth(): Promise<void> {
    await this.logout();
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) return this.currentUser;
    try {
      const userJson = await secureReadItem(USER_KEY);
      if (userJson) {
        this.currentUser = JSON.parse(userJson);
        return this.currentUser;
      }
    } catch (error) {
      devError('Error loading user:', error);
    }
    return null;
  }

  async loadStoredAuth(): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        await secureRemoveItem(USER_KEY);
        this.currentUser = null;
        return false;
      }
      const userJson = await secureReadItem(USER_KEY);
      if (userJson) {
        this.currentUser = JSON.parse(userJson);
        return true;
      }
      this.currentUser = null;
      return true;
    } catch (error) {
      devError('Error loading stored auth:', error);
      this.currentUser = null;
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
