-- Migration: Fix Schools RLS Policy with Profile Fallback
-- Purpose: Ensure RLS works even when JWT doesn't have school_id claim yet
--          Uses profiles table as fallback to check user's school_id
-- Author: Senior Software Engineer
-- Date: 2026-01-19

-- ============================================
-- 1. CREATE HELPER FUNCTION FOR SCHOOL ACCESS
-- ============================================
-- This function checks both JWT claims and profiles table
create or replace function user_school_id()
returns uuid language sql stable as $$
  select coalesce(
    auth_claim('school_id')::uuid,
    (select school_id from profiles where id = auth.uid())
  );
$$;

-- ============================================
-- 2. UPDATE SCHOOLS RLS POLICY
-- ============================================
-- Replace the existing policy with one that checks both JWT and profiles
drop policy if exists schools_read_own on schools;
create policy schools_read_own on schools
  for select using (
    id = user_school_id()
    and (
      auth_claim('role') in ('principal', 'clerk')
      or exists (
        select 1 from profiles 
        where id = auth.uid() 
        and role in ('principal', 'clerk')
        and school_id = schools.id
      )
    )
  );

-- ============================================
-- 3. VERIFY RLS IS ENABLED
-- ============================================
alter table schools enable row level security;
