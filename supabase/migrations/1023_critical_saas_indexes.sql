-- Migration: Critical Indexes for SaaS with 1M+ Users
-- Purpose: Optimize queries for multi-tenant SaaS with Row Level Security
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- Helper Function: Safe Index Creation
-- ============================================
-- Drop existing function if it exists (to handle parameter name changes)
drop function if exists create_production_index(text, text, text, text);
drop function if exists create_production_index(text, text, text);

-- Create the helper function
create or replace function create_production_index(
  index_name text,
  table_name text,
  column_definition text,
  description text default null
)
returns void as $$
begin
  if not exists (
    select 1 from pg_indexes 
    where indexname = index_name
  ) then
    execute format('create index %I on %I %s', index_name, table_name, column_definition);
    
    if description is not null then
      execute format('comment on index %I is %L', index_name, description);
    end if;
  end if;
end;
$$ language plpgsql;

-- ============================================
-- 1. STUDENTS TABLE - Critical Indexes
-- ============================================
-- Students are queried heavily in all modules

-- Multi-tenant + status filtering (most common query pattern)
select create_production_index(
  'idx_students_school_status_optimized',
  'students',
  '(school_id, status) where school_id is not null and status = ''active''',
  'Optimizes: Get active students by school (most common query)'
);

-- Class + section filtering (attendance, marks, fees)
select create_production_index(
  'idx_students_school_class_section',
  'students',
  '(school_id, class_group_id, section_id, status) where school_id is not null',
  'Optimizes: Get students by class and section (attendance, marks)'
);

-- Profile lookup (for joins)
select create_production_index(
  'idx_students_profile_school',
  'students',
  '(profile_id, school_id) where school_id is not null',
  'Optimizes: Join with profiles table'
);

-- Roll number search (common in UI)
select create_production_index(
  'idx_students_roll_number_search',
  'students',
  '(school_id, roll_number) where roll_number is not null and school_id is not null',
  'Optimizes: Search students by roll number'
);

-- ============================================
-- 2. PROFILES TABLE - Critical Indexes
-- ============================================
-- Profiles are joined with students, teachers, etc.

-- Multi-tenant + role filtering (dashboard, staff lists)
select create_production_index(
  'idx_profiles_school_role_approval',
  'profiles',
  '(school_id, role, approval_status) where school_id is not null',
  'Optimizes: Get teachers/clerks by school and approval status'
);

-- Username lookup (login, signup)
select create_production_index(
  'idx_profiles_username_school',
  'profiles',
  '(username, school_id) where username is not null and school_id is not null',
  'Optimizes: Username lookup during login/signup'
);

-- Email lookup (authentication)
select create_production_index(
  'idx_profiles_email',
  'profiles',
  '(email) where email is not null',
  'Optimizes: Email lookup (unique across all schools)'
);

-- ============================================
-- 3. MARKS TABLE - Critical Indexes
-- ============================================
-- Marks are queried heavily for reports

-- Multi-tenant + exam filtering
select create_production_index(
  'idx_marks_school_exam',
  'marks',
  '(school_id, exam_id) where school_id is not null',
  'Optimizes: Get marks by exam (results page)'
);

-- Student marks lookup
select create_production_index(
  'idx_marks_student_school',
  'marks',
  '(student_id, school_id) where school_id is not null',
  'Optimizes: Get all marks for a student'
);

-- Subject + exam filtering
select create_production_index(
  'idx_marks_exam_subject',
  'marks',
  '(exam_id, subject_id, school_id) where school_id is not null',
  'Optimizes: Get marks by exam and subject'
);

-- ============================================
-- 4. TEACHER ASSIGNMENTS - Critical Indexes
-- ============================================
-- Used for filtering students, classes

-- Teacher's assigned classes
select create_production_index(
  'idx_teacher_assignments_teacher_school',
  'teacher_assignments',
  '(teacher_id, school_id) where school_id is not null',
  'Optimizes: Get teacher''s assigned classes'
);

-- Class assignments lookup
select create_production_index(
  'idx_teacher_assignments_class',
  'teacher_assignments',
  '(class_group_id, section_id, school_id) where school_id is not null',
  'Optimizes: Get teachers assigned to a class'
);

-- ============================================
-- 5. SALARY TABLES - Critical Indexes
-- ============================================
-- Salary queries are heavy and frequent

-- Teacher salary records lookup
select create_production_index(
  'idx_salary_records_teacher_period',
  'teacher_salary_records',
  '(teacher_id, year DESC, month DESC, school_id) where school_id is not null',
  'Optimizes: Get teacher salary records by period'
);

-- Salary structure lookup
select create_production_index(
  'idx_salary_structure_teacher_active',
  'teacher_salary_structure',
  '(teacher_id, school_id, is_active) where is_active = true and school_id is not null',
  'Optimizes: Get active salary structure for teacher'
);

-- ============================================
-- 6. EXAM TABLE - Critical Indexes
-- ============================================
-- Exams are queried for marks, results

-- Multi-tenant + date filtering
select create_production_index(
  'idx_exams_school_date',
  'exams',
  '(school_id, start_date DESC) where school_id is not null',
  'Optimizes: Get exams by school, ordered by date'
);

-- ============================================
-- 7. SUBJECTS TABLE - Critical Indexes
-- ============================================
-- Subjects are joined with marks, assignments

-- Multi-tenant lookup
select create_production_index(
  'idx_subjects_school',
  'subjects',
  '(school_id) where school_id is not null',
  'Optimizes: Get subjects by school'
);

-- ============================================
-- 8. CLASS GROUPS TABLE - Critical Indexes
-- ============================================
-- Classes are used everywhere

-- Multi-tenant lookup
select create_production_index(
  'idx_class_groups_school_optimized',
  'class_groups',
  '(school_id) where school_id is not null',
  'Optimizes: Get classes by school'
);

-- ============================================
-- 9. STUDENT GUARDIANS - Critical Indexes
-- ============================================
-- Used for parent access checks

-- Guardian lookup
select create_production_index(
  'idx_guardians_student_guardian',
  'student_guardians',
  '(student_id, guardian_profile_id)',
  'Optimizes: Check if user is guardian of student'
);

-- ============================================
-- 10. FEE TABLES - Critical Indexes
-- ============================================
-- Fee queries are heavy

-- Class fee defaults lookup
select create_production_index(
  'idx_class_fee_defaults_class_active',
  'class_fee_defaults',
  '(class_group_id, is_active, school_id) where is_active = true and school_id is not null',
  'Optimizes: Get active class fees'
);

-- Optional fee definitions
select create_production_index(
  'idx_optional_fees_class_active',
  'optional_fee_definitions',
  '(class_group_id, is_active, school_id) where is_active = true and school_id is not null',
  'Optimizes: Get active optional fees for class'
);

-- ============================================
-- 11. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================
do $$
begin
  -- Analyze high-traffic tables
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'students') then
    analyze students;
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    analyze profiles;
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'marks') then
    analyze marks;
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'monthly_fee_components') then
    analyze monthly_fee_components;
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_salary_records') then
    analyze teacher_salary_records;
  end if;
end $$;

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify indexes were created:
--
-- SELECT 
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE indexname LIKE 'idx_%'
--   AND tablename IN ('students', 'profiles', 'marks', 'teacher_assignments', 'teacher_salary_records', 'exams', 'subjects', 'class_groups')
-- ORDER BY tablename, indexname;
