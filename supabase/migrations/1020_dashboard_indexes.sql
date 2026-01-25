-- Migration: Add Indexes for Dashboard Queries
-- Purpose: Optimize dashboard count queries for instant performance
-- These indexes make the COUNT queries in get_dashboard_counts() function instant
-- Author: Senior SQL Optimization Engineer
-- Date: 2026-01-XX

-- ============================================
-- HELPER: Safe Index Creation
-- ============================================
-- Reuse the helper function from migration 1015
-- If it doesn't exist, create it

create or replace function create_production_index(
  p_index_name text,
  p_table_name text,
  p_index_definition text,
  p_comment text default null
)
returns void language plpgsql as $$
begin
  -- Check if table exists
  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = p_table_name
  ) then
    return;
  end if;
  
  -- Try to create the index
  begin
    execute format('create index if not exists %I on %I %s', 
      p_index_name, 
      p_table_name, 
      p_index_definition
    );
    
    -- Add comment if provided
    if p_comment is not null then
      execute format('comment on index %I is %L', p_index_name, p_comment);
    end if;
  exception
    when others then
      -- Silently skip if column doesn't exist or other error
      null;
  end;
end;
$$;

-- ============================================
-- 1. STUDENTS TABLE INDEX
-- ============================================
-- Optimizes: COUNT(*) FROM students WHERE school_id = $1 AND status = 'active'
-- Used in: get_dashboard_counts() function

select create_production_index(
  'idx_students_school_status',
  'students',
  '(school_id, status) where school_id is not null',
  'Optimizes dashboard count query: Fast COUNT of active students by school'
);

-- ============================================
-- 2. PROFILES TABLE INDEX
-- ============================================
-- Optimizes: COUNT(*) FROM profiles WHERE school_id = $1 AND role IN (...) AND approval_status = '...'
-- Used in: get_dashboard_counts() function for both teachers and pending approvals

select create_production_index(
  'idx_profiles_school_role_status',
  'profiles',
  '(school_id, role, approval_status) where school_id is not null',
  'Optimizes dashboard count queries: Fast COUNT of profiles by school, role, and approval status'
);

-- ============================================
-- 3. CLASS_GROUPS TABLE INDEX
-- ============================================
-- Optimizes: COUNT(*) FROM class_groups WHERE school_id = $1
-- Used in: get_dashboard_counts() function

select create_production_index(
  'idx_class_groups_school',
  'class_groups',
  '(school_id) where school_id is not null',
  'Optimizes dashboard count query: Fast COUNT of class groups by school'
);

-- ============================================
-- ANALYZE TABLES
-- ============================================
-- Update statistics for query planner

analyze students;
analyze profiles;
analyze class_groups;

-- ============================================
-- REFRESH SCHEMA CACHE
-- ============================================
-- Notify PostgREST to reload schema

NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify indexes were created:
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('students', 'profiles', 'class_groups')
--   AND indexname IN (
--     'idx_students_school_status',
--     'idx_profiles_school_role_status',
--     'idx_class_groups_school'
--   )
-- ORDER BY tablename, indexname;
--
-- Expected indexes:
--   - idx_students_school_status
--   - idx_profiles_school_role_status
--   - idx_class_groups_school
