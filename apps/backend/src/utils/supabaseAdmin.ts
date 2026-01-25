/**
 * Shared Supabase Admin Client
 * 
 * Reuses a single client instance across all requests instead of creating
 * a new client for each request. This reduces:
 * - Connection overhead
 * - Memory usage
 * - Request latency
 * 
 * Benefits:
 * - Fewer connections to database
 * - Lower memory footprint
 * - Faster requests (no client creation overhead)
 * - Production safe (connection pooling handled by Supabase)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
  );
}

// Create single shared instance
export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
