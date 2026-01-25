import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import * as authServiceFunctions from './auth.service';
import { User, AuthResponse } from '../types';

const TOKEN_KEY = '@school_saas:token';
const USER_KEY = '@school_saas:user';

export class AuthService {
  private currentUser: User | null = null;

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await authServiceFunctions.login(email, password);
      await this.saveAuth(response);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      throw new Error(message);
    }
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
    try {
      const response = await authServiceFunctions.signupPrincipal(data);
      await this.saveAuth(response);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      throw new Error(message);
    }
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
    try {
      const response = await authServiceFunctions.signupJoin(data);
      await this.saveAuth(response);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      throw new Error(message);
    }
  }

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    await api.setToken(null);
    this.currentUser = null;
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (userJson) {
        this.currentUser = JSON.parse(userJson);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }

    return null;
  }

  async loadStoredAuth(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userJson = await AsyncStorage.getItem(USER_KEY);

      console.log('[AuthService] Loading stored auth:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        hasUserJson: !!userJson
      });

      // Validate that token exists and is not empty
      if (token && token.trim() && userJson) {
        await api.setToken(token);
        this.currentUser = JSON.parse(userJson);
        console.log('[AuthService] Stored auth loaded successfully. Token set in API service.');
        return true;
      } else {
        // Clear any invalid/empty tokens
        if (token && !token.trim()) {
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
        await api.setToken(null);
        this.currentUser = null;
        console.log('[AuthService] No valid stored auth found.');
      }
    } catch (error) {
      console.error('[AuthService] Error loading stored auth:', error);
      // Clear corrupted data
      await api.setToken(null);
      this.currentUser = null;
    }

    return false;
  }

  private async saveAuth(response: AuthResponse): Promise<void> {
    console.log('[AuthService] Saving auth data:', {
      hasToken: !!response.token,
      tokenLength: response.token?.length || 0,
      hasUser: !!response.user
    });
    
    if (!response.token) {
      console.error('[AuthService] Cannot save auth - no token in response!');
      throw new Error('Login response missing token');
    }
    
    // Set token in API service FIRST before saving to storage
    // This ensures token is available immediately, even if storage write is delayed
    await api.setToken(response.token);
    this.currentUser = response.user;
    
    // Then save to AsyncStorage
    await AsyncStorage.setItem(TOKEN_KEY, response.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
    
    // Verify token was saved
    const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
    console.log('[AuthService] Token saved. Verification:', {
      saved: !!savedToken,
      matches: savedToken === response.token
    });
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();

