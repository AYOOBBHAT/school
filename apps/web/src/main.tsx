import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './utils/supabase';
import './styles.css';

declare global {
  interface Window {
    __handlingUnauthorized?: boolean;
  }
}

// Setup React Query with production-grade defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes cache
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Global 401 handler (centralized)
// If session is revoked (e.g. password changed elsewhere), auto-logout and redirect to /login.
(() => {
  // Preserve original fetch
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    const url =
      typeof args[0] === 'string'
        ? args[0]
        : (args[0] as Request | undefined)?.url;

    const isAuthRoute =
      typeof url === 'string' &&
      (url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password'));

    if (response.status === 401 && !isAuthRoute) {
      if (window.__handlingUnauthorized) return response;
      window.__handlingUnauthorized = true;

      // UX first: tell user before redirecting
      alert('Session expired. Please login again.');

      setTimeout(() => {
        try {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          void supabase.auth.signOut();
        } catch {
          // ignore
        } finally {
          window.location.href = '/login';
        }
      }, 300);
    }

    return response;
  };
})();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);


