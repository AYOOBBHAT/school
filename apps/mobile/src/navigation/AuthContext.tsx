import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../shared/types';
import { authService } from '../shared/services/auth';
import { supabase } from '../shared/lib/supabase';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  logout: () => Promise<void>;
  clearStoredAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await authService.loadStoredAuth();
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser ?? null);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetUser = (newUser: User | null) => {
    setUser(newUser);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  const handleClearStoredAuth = async () => {
    await authService.clearStoredAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: handleSetUser,
        loading,
        logout: handleLogout,
        clearStoredAuth: handleClearStoredAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
