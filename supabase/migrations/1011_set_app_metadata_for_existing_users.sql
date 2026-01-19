-- Migration: Set app_metadata for All Existing Users
-- Purpose: Ensure all existing users have school_id and role in app_metadata
--          This makes JWT custom claims work for RLS policies
-- Author: Senior Software Engineer
-- Date: 2026-01-19

-- ============================================
-- NOTE: This migration requires manual execution via Supabase Dashboard
--       or a backend script because app_metadata can only be set via Admin API
-- ============================================

-- This SQL file documents what needs to be done, but the actual update
-- must be done via Supabase Admin API (auth.admin.updateUserById)

-- The backend login endpoint (/auth/login) now automatically sets app_metadata
-- when users log in. Existing users will get their app_metadata set on next login.

-- For immediate update of all users, use this Node.js script:
/*
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateAllUsersAppMetadata() {
  // Get all profiles with school_id and role
  const { data: profiles, error } = await adminSupabase
    .from('profiles')
    .select('id, role, school_id');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  for (const profile of profiles) {
    const appMetadata = {};
    if (profile.school_id) appMetadata.school_id = profile.school_id;
    if (profile.role) appMetadata.role = profile.role;

    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      profile.id,
      { app_metadata: appMetadata }
    );

    if (updateError) {
      console.error(`Error updating user ${profile.id}:`, updateError);
    } else {
      console.log(`Updated app_metadata for user ${profile.id}`);
    }
  }
}

updateAllUsersAppMetadata();
*/

-- For now, users will get app_metadata set automatically on next login
-- via the updated /auth/login endpoint
