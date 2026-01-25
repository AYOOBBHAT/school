-- Migration: Add Unique Constraint for Attendance UPSERT
-- Purpose: Enable efficient UPSERT operations for bulk attendance
-- This constraint allows ON CONFLICT handling for (student_id, class_group_id, attendance_date)
-- Author: Senior SQL Optimization Engineer
-- Date: 2026-01-XX

-- ============================================
-- 1. Remove old unique constraint if it exists
-- ============================================
-- The old constraint was (student_id, attendance_date) which doesn't allow
-- the same student to have attendance in different classes on the same date
-- We need (student_id, class_group_id, attendance_date) instead

-- Drop the old unique constraint if it exists
do $$
begin
  -- Check if the old constraint exists
  if exists (
    select 1 from pg_constraint 
    where conname = 'student_attendance_student_id_attendance_date_key'
  ) then
    alter table student_attendance 
    drop constraint student_attendance_student_id_attendance_date_key;
  end if;
  
  -- Also check for unique index (might be created as index instead of constraint)
  if exists (
    select 1 from pg_indexes 
    where tablename = 'student_attendance' 
      and indexname = 'ux_student_attendance_unique'
  ) then
    drop index if exists ux_student_attendance_unique;
  end if;
end $$;

-- ============================================
-- 2. Add new unique constraint
-- ============================================
-- This allows UPSERT operations with ON CONFLICT
-- A student can have attendance in different classes on the same date
-- But cannot have duplicate attendance in the same class on the same date

alter table student_attendance
add constraint ux_student_attendance_student_class_date 
unique (student_id, class_group_id, attendance_date);

-- Add comment
comment on constraint ux_student_attendance_student_class_date on student_attendance is 
  'Unique constraint for UPSERT operations. Prevents duplicate attendance for same student, class, and date.';

-- ============================================
-- 3. Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this query to verify the constraint was created:
--
-- SELECT 
--   conname as constraint_name,
--   pg_get_constraintdef(oid) as constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'student_attendance'::regclass
--   AND conname = 'ux_student_attendance_student_class_date';
--
-- Expected result:
--   constraint_name: ux_student_attendance_student_class_date
--   constraint_definition: UNIQUE (student_id, class_group_id, attendance_date)
