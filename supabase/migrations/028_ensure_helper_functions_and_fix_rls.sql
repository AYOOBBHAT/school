-- Migration: Ensure Helper Functions Exist and Fix RLS for Backend Access
-- This migration ensures helper functions exist and RLS policies don't interfere with service role access
-- The backend uses service role key which bypasses RLS, but we ensure policies are correct for direct Supabase access

-- ============================================
-- Helper Functions (Required for RLS)
-- ============================================

-- Function to get user's school_id from profiles table
-- Returns null if user not found or school_id is null (for service role compatibility)
create or replace function get_user_school_id()
returns uuid as $$
  select school_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Function to get user's role from profiles table
-- Returns null if user not found (for service role compatibility)
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================
-- IMPORTANT: Service Role Bypasses RLS
-- ============================================
-- The backend uses SUPABASE_SERVICE_ROLE_KEY which completely bypasses RLS.
-- These policies only apply to direct Supabase client access (anon key).
-- If you're getting errors, check:
-- 1. Backend is using service role key (not anon key)
-- 2. User's profile has a valid school_id
-- 3. Backend server is running and accessible

-- ============================================
-- RLS Policies - Profiles (Staff)
-- These only apply to anon key access, not service role
-- ============================================
drop policy if exists mt_profiles_select on profiles;
create policy mt_profiles_select on profiles
  for select using (
    -- Allow if user's school_id matches
    (school_id = get_user_school_id() and get_user_school_id() is not null)
    -- Or if user is viewing their own profile
    or (id = auth.uid())
    -- Or if user is principal/clerk viewing staff in their school
    or (
      school_id = get_user_school_id() 
      and get_user_school_id() is not null
      and get_user_role() in ('principal', 'clerk')
    )
  );

drop policy if exists mt_profiles_modify on profiles;
create policy mt_profiles_modify on profiles
  for all using (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- Ensure RLS is enabled (but service role bypasses it)
-- ============================================
alter table profiles enable row level security;
alter table class_groups enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table sections enable row level security;
alter table classification_types enable row level security;
alter table classification_values enable row level security;
alter table class_classifications enable row level security;
alter table class_subjects enable row level security;
alter table teacher_assignments enable row level security;
alter table transport_routes enable row level security;
alter table class_fee_defaults enable row level security;

-- ============================================
-- RLS Policies - Transport Routes
-- ============================================
drop policy if exists mt_transport_routes_select on transport_routes;
create policy mt_transport_routes_select on transport_routes
  for select using (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() in ('principal', 'clerk', 'teacher', 'student', 'parent')
  );

drop policy if exists mt_transport_routes_modify on transport_routes;
create policy mt_transport_routes_modify on transport_routes
  for all using (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Class Fee Defaults
-- ============================================
drop policy if exists mt_class_fee_defaults_select on class_fee_defaults;
create policy mt_class_fee_defaults_select on class_fee_defaults
  for select using (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
  );

drop policy if exists mt_class_fee_defaults_modify on class_fee_defaults;
create policy mt_class_fee_defaults_modify on class_fee_defaults
  for all using (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_school_id() is not null
    and get_user_role() = 'principal'
  );

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- Diagnostic Query (run this to check your setup)
-- ============================================
-- SELECT 
--   proname as function_name,
--   prosrc as function_body
-- FROM pg_proc 
-- WHERE proname IN ('get_user_school_id', 'get_user_role');
--
-- This should return both functions if they exist correctly.

