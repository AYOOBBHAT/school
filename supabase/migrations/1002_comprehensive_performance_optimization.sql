-- Migration: Comprehensive Performance Optimization (FIXED - No Over-Indexing)
-- Purpose: Optimize database for SaaS school management platform
-- Strategy: 1 primary filter + 1 pagination + 1-2 business indexes per table (NOT 4-5)
-- Requirements:
--   1. Index school_id everywhere (consolidated, no overlaps)
--   2. Use PgBouncer (documented)
--   3. Paginate all lists
--   4. Avoid N+1 queries
--   5. Avoid select *

-- ============================================
-- HELPER FUNCTION: Safe Index Creation
-- ============================================
-- Creates index only if table exists and columns exist

create or replace function create_index_if_table_exists(
  p_index_name text,
  p_table_name text,
  p_index_definition text
)
returns void language plpgsql as $$
declare
  v_table_exists boolean;
  v_columns_exist boolean;
  v_column_name text;
  v_index_def_text text;
begin
  -- Check if table exists
  select exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = p_table_name
  ) into v_table_exists;
  
  if not v_table_exists then
    return;
  end if;
  
  -- Extract column names from index definition (simple extraction)
  -- Check if school_id column exists (most common case)
  v_index_def_text := lower(p_index_definition);
  if v_index_def_text like '%school_id%' then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
      and table_name = p_table_name
      and column_name = 'school_id'
    ) into v_columns_exist;
    
    if not v_columns_exist then
      return;
    end if;
  end if;
  
  -- Try to create the index, catch any errors (e.g., column doesn't exist)
  begin
    execute format('create index if not exists %I on %I %s', 
      p_index_name, 
      p_table_name, 
      p_index_definition
    );
  exception
    when others then
      -- Silently skip if column doesn't exist or other error
      -- This handles cases where the index definition references non-existent columns
      null;
  end;
end;
$$;

-- ============================================
-- 1. PRIMARY FILTER INDEXES (school_id)
-- ============================================
-- ONE index per table for school_id filtering (multi-tenant isolation)

-- Core tables (check if they exist first)
select create_index_if_table_exists('idx_profiles_school_id', 'profiles', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_class_groups_school_id', 'class_groups', '(school_id)');
select create_index_if_table_exists('idx_subjects_school_id', 'subjects', '(school_id)');
select create_index_if_table_exists('idx_students_school_id', 'students', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_exams_school_id', 'exams', '(school_id)');
select create_index_if_table_exists('idx_marks_school_id', 'marks', '(school_id) where school_id is not null');

-- Attendance tables (some may not exist depending on migrations)
select create_index_if_table_exists('idx_attendance_school_id', 'attendance', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_student_attendance_school_id', 'student_attendance', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_teacher_attendance_school_id', 'teacher_attendance', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_class_attendance_lock_school_id', 'class_attendance_lock', '(school_id) where school_id is not null');

-- Fee tables (check if they exist first - some may not exist depending on migrations)
select create_index_if_table_exists('idx_fee_structures_school_id', 'fee_structures', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_fee_categories_school_id', 'fee_categories', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_class_fees_school_id', 'class_fees', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_transport_routes_school_id', 'transport_routes', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_transport_fees_school_id', 'transport_fees', '(school_id) where school_id is not null');
-- Optional fees (may not exist - created in migration 010, might be removed)
select create_index_if_table_exists('idx_optional_fees_school_id', 'optional_fees', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_student_transport_school_id', 'student_transport', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_student_custom_fees_school_id', 'student_custom_fees', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_fee_bills_school_id', 'fee_bills', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_fee_bill_items_school_id', 'fee_bill_items', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_fee_payments_school_id', 'fee_payments', '(school_id) where school_id is not null');
-- These tables may not exist depending on which migrations were run
select create_index_if_table_exists('idx_class_fee_defaults_school_id', 'class_fee_defaults', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_transport_fee_defaults_school_id', 'transport_fee_defaults', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_optional_fee_definitions_school_id', 'optional_fee_definitions', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_student_fee_overrides_school_id', 'student_fee_overrides', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_student_optional_fees_school_id', 'student_optional_fees', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_fine_rules_school_id', 'fine_rules', '(school_id) where school_id is not null');

-- Management tables (check if they exist first)
select create_index_if_table_exists('idx_teacher_assignments_school_id', 'teacher_assignments', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_teacher_salary_structure_school_id', 'teacher_salary_structure', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_teacher_salary_records_school_id', 'teacher_salary_records', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_clerk_logs_school_id', 'clerk_logs', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_timetable_school_id', 'timetable', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_classification_types_school_id', 'classification_types', '(school_id)');
select create_index_if_table_exists('idx_exam_subjects_school_id', 'exam_subjects', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_exam_schedule_school_id', 'exam_schedule', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_exam_classes_school_id', 'exam_classes', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_class_subjects_school_id', 'class_subjects', '(school_id) where school_id is not null');
-- These tables may not exist depending on which migrations were run
select create_index_if_table_exists('idx_monthly_fee_components_school_id', 'monthly_fee_components', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_monthly_fee_payments_school_id', 'monthly_fee_payments', '(school_id) where school_id is not null');
select create_index_if_table_exists('idx_teacher_salary_payments_school_id', 'teacher_salary_payments', '(school_id) where school_id is not null');

-- ============================================
-- 2. PAGINATION INDEXES (ONE per table)
-- ============================================
-- Supports ORDER BY created_at DESC, id for cursor-based pagination

select create_index_if_table_exists('idx_profiles_pagination', 'profiles', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_students_pagination', 'students', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_class_groups_pagination', 'class_groups', '(school_id, created_at desc, id desc)');
select create_index_if_table_exists('idx_subjects_pagination', 'subjects', '(school_id, created_at desc, id desc)');
select create_index_if_table_exists('idx_exams_pagination', 'exams', '(school_id, created_at desc, id desc)');
select create_index_if_table_exists('idx_marks_pagination', 'marks', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_fee_bills_pagination', 'fee_bills', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_fee_payments_pagination', 'fee_payments', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_student_attendance_pagination', 'student_attendance', '(school_id, attendance_date desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_teacher_assignments_pagination', 'teacher_assignments', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_teacher_attendance_pagination', 'teacher_attendance', '(school_id, date desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_fee_categories_pagination', 'fee_categories', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_transport_routes_pagination', 'transport_routes', '(school_id, created_at desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_clerk_logs_pagination', 'clerk_logs', '(school_id, timestamp desc, id desc) where school_id is not null');
select create_index_if_table_exists('idx_teacher_salary_records_pagination', 'teacher_salary_records', '(school_id, created_at desc, id desc) where school_id is not null');

-- ============================================
-- 3. CRITICAL BUSINESS INDEXES (Hot Paths)
-- ============================================

-- 🔴 A. Auth-heavy queries: "All teachers/clerks in a school"
-- Used frequently for dashboards and WhatsApp bot queries
select create_index_if_table_exists('idx_profiles_school_role_id', 'profiles', '(school_id, role, id) where school_id is not null');

-- 🔴 B. Attendance uniqueness: One record per student per day
-- Prevents duplicates, speeds up upserts, simplifies logic
-- Only create if table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    create unique index if not exists ux_student_attendance_unique on student_attendance(student_id, attendance_date);
  end if;
end $$;

-- 🔴 C. Unpaid fees hot path: Very frequently queried
-- "Show all pending bills" - one of the most important queries
select create_index_if_table_exists('idx_fee_bills_unpaid', 'fee_bills', '(school_id, status, student_id) where status = ''pending''');

-- Student lookup by roll number (common search)
select create_index_if_table_exists('idx_students_roll_number', 'students', '(school_id, roll_number) where roll_number is not null and school_id is not null');

-- School lookup by join code (signup flow)
select create_index_if_table_exists('idx_schools_join_code', 'schools', '(join_code) where join_code is not null');

-- ============================================
-- 4. N+1 QUERY PREVENTION (Composite Indexes)
-- ============================================
-- Only for actual join patterns, not speculative

-- Students with class/section (common join)
select create_index_if_table_exists('idx_students_class_section', 'students', '(school_id, class_group_id, section_id, status) where school_id is not null');

-- Marks with student/exam/subject (common join)
select create_index_if_table_exists('idx_marks_student_exam_subject', 'marks', '(student_id, exam_id, subject_id, school_id) where school_id is not null');

-- Fee bills with student/status (common join)
select create_index_if_table_exists('idx_fee_bills_student_status', 'fee_bills', '(student_id, status, due_date, school_id) where school_id is not null');

-- Fee payments with bill/student (common join)
select create_index_if_table_exists('idx_fee_payments_bill_student', 'fee_payments', '(bill_id, student_id, payment_date, school_id) where school_id is not null');

-- Teacher assignments (common join)
select create_index_if_table_exists('idx_teacher_assignments_teacher_class', 'teacher_assignments', '(teacher_id, class_group_id, subject_id, school_id) where school_id is not null');

-- Student guardians (common join)
select create_index_if_table_exists('idx_student_guardians_student_guardian', 'student_guardians', '(student_id, guardian_profile_id)');

-- ============================================
-- 5. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================
-- Update statistics for better query planning
-- Note: Ensure autovacuum is aggressive on high-write tables

-- Analyze tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    analyze profiles;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'students') then
    analyze students;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_groups') then
    analyze class_groups;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'subjects') then
    analyze subjects;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'exams') then
    analyze exams;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'marks') then
    analyze marks;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fee_bills') then
    analyze fee_bills;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fee_payments') then
    analyze fee_payments;
  end if;
end $$;
-- Analyze tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    analyze student_attendance;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_assignments') then
    analyze teacher_assignments;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_attendance') then
    analyze teacher_attendance;
  end if;
end $$;
-- Analyze fee-related tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fee_categories') then
    analyze fee_categories;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_fees') then
    analyze class_fees;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'transport_routes') then
    analyze transport_routes;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'transport_fees') then
    analyze transport_fees;
  end if;
end $$;
-- Analyze tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_transport') then
    analyze student_transport;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_custom_fees') then
    analyze student_custom_fees;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fee_bill_items') then
    analyze fee_bill_items;
  end if;
end $$;
-- Analyze salary and scholarship tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_salary_structure') then
    analyze teacher_salary_structure;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_salary_records') then
    analyze teacher_salary_records;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'scholarships') then
    analyze scholarships;
  end if;
end $$;
-- Analyze tables only if they exist
do $$
begin
  -- Analyze tables that may not exist
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_fee_profile') then
    analyze student_fee_profile;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_fee_overrides') then
    analyze student_fee_overrides;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_fee_defaults') then
    analyze class_fee_defaults;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'transport_fee_defaults') then
    analyze transport_fee_defaults;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'optional_fee_definitions') then
    analyze optional_fee_definitions;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_optional_fees') then
    analyze student_optional_fees;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fine_rules') then
    analyze fine_rules;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'monthly_fee_components') then
    analyze monthly_fee_components;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'monthly_fee_payments') then
    analyze monthly_fee_payments;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_salary_payments') then
    analyze teacher_salary_payments;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'optional_fees') then
    analyze optional_fees;
  end if;
end $$;
-- Analyze tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'timetable') then
    analyze timetable;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'school_holidays') then
    analyze school_holidays;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_attendance_lock') then
    analyze class_attendance_lock;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'exam_subjects') then
    analyze exam_subjects;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'exam_schedule') then
    analyze exam_schedule;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'exam_classes') then
    analyze exam_classes;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_subjects') then
    analyze class_subjects;
  end if;
end $$;
-- Analyze remaining tables only if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classification_types') then
    analyze classification_types;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classification_values') then
    analyze classification_values;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_classifications') then
    analyze class_classifications;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_guardians') then
    analyze student_guardians;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'clerk_logs') then
    analyze clerk_logs;
  end if;
end $$;

-- ============================================
-- 6. AUTOVACUUM CONFIGURATION RECOMMENDATION
-- ============================================
-- For high-write tables, ensure aggressive autovacuum
-- Run this in Supabase Dashboard → Database → Settings → Autovacuum

-- Recommended settings for high-write tables:
-- ALTER TABLE student_attendance SET (
--   autovacuum_vacuum_scale_factor = 0.05,
--   autovacuum_analyze_scale_factor = 0.02
-- );
-- 
-- ALTER TABLE fee_payments SET (
--   autovacuum_vacuum_scale_factor = 0.05,
--   autovacuum_analyze_scale_factor = 0.02
-- );
-- 
-- ALTER TABLE monthly_fee_components SET (
--   autovacuum_vacuum_scale_factor = 0.05,
--   autovacuum_analyze_scale_factor = 0.02
-- );

-- ============================================
-- 7. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- COMMENTS AND DOCUMENTATION
-- ============================================
-- Add comments only if indexes exist
do $$
begin
  -- Comment on indexes only if they exist
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_profiles_school_id') then
    comment on index idx_profiles_school_id is 'Primary filter index for multi-tenant isolation';
  end if;
  
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_profiles_school_role_id') then
    comment on index idx_profiles_school_role_id is 'Auth-heavy queries: All teachers/clerks in a school - critical for dashboards';
  end if;
  
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'ux_student_attendance_unique') then
    comment on index ux_student_attendance_unique is 'Uniqueness constraint: One attendance record per student per day - prevents duplicates';
  end if;
  
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_fee_bills_unpaid') then
    comment on index idx_fee_bills_unpaid is 'Hot path: Unpaid/pending fee bills - one of the most frequently queried indexes';
  end if;
  
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_students_pagination') then
    comment on index idx_students_pagination is 'Pagination index: Supports ORDER BY created_at DESC, id for cursor-based pagination';
  end if;
end $$;
