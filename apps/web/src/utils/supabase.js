import { createClient } from '@supabase/supabase-js';
// Singleton Supabase client to avoid multiple instances
let supabaseInstance = null;
export function getSupabaseClient() {
    if (!supabaseInstance) {
        supabaseInstance = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
    }
    return supabaseInstance;
}
// Export a default instance for convenience
export const supabase = getSupabaseClient();
