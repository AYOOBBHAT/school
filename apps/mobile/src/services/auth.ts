import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { User, AuthResponse } from '../types';

const TOKEN_KEY = '@school_saas:token';
const USER_KEY = '@school_saas:user';

export class AuthService {
  private currentUser: User | null = null;

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.login(email, password);
      await this.saveAuth(response);
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
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
      const response = await api.signupPrincipal(data);
      await this.saveAuth(response);
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
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
      const response = await api.signupJoin(data);
      await this.saveAuth(response);
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  }

  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    api.setToken(null);
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

      if (token && userJson) {
        api.setToken(token);
        this.currentUser = JSON.parse(userJson);
        return true;
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    }

    return false;
  }

  private async saveAuth(response: AuthResponse): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, response.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUser = response.user;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();

