/**
 * Centralized Type Exports
 * Single source of truth for all types
 */

export * from './user';
export * from './models';
export * from './responses';
export * from './navigation';

// Auth-specific response type
export interface AuthResponse {
  user: import('./user').User;
  token: string;
}
