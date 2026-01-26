-- Migration: Atomic Attendance Marking RPC Function
-- Purpose: Move attendance write logic to PostgreSQL for atomic operations and better concurrency
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- RPC Function: mark_attendance_atomic
-- ============================================
-- This function performs atomic attendance marking in a single transaction
-- Eliminates race conditions and reduces round trips from Node.js
--
-- Parameters:
--   p_school_id: UUID of the school
--   p_class_group_id: UUID of the class group
--   p_date: Date for attendance (DATE type)
--   p_marked_by: UUID of the user marking attendance
--   p_records: JSONB array of attendance records
--     Each record: { "student_id": "uuid", "status": "present|absent|late|leave" }
--
-- Returns:
--   JSON object with success status and affected row count
--
-- Security:
--   Uses SECURITY DEFINER to bypass RLS (admin function)
--   Caller must have proper authentication via Supabase

create or replace function mark_attendance_atomic(
  p_school_id uuid,
  p_class_group_id uuid,
  p_date date,
  p_marked_by uuid,
  p_records jsonb,
  p_section_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_affected int := 0;
  v_error_message text;
begin
  -- Validate input
  if p_school_id is null or p_class_group_id is null or p_date is null or p_marked_by is null then
    return json_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  end if;

  if p_records is null or jsonb_array_length(p_records) = 0 then
    return json_build_object(
      'success', false,
      'error', 'No attendance records provided'
    );
  end if;

  -- Upsert attendance records in ONE atomic statement
  -- Uses ON CONFLICT to update existing records or insert new ones
  -- Constraint: unique(student_id, class_group_id, attendance_date)
  insert into student_attendance (
    school_id,
    student_id,
    class_group_id,
    section_id,
    attendance_date,
    status,
    marked_by,
    is_locked
  )
  select
    p_school_id,
    (rec->>'student_id')::uuid,
    p_class_group_id,
    p_section_id,
    p_date,
    rec->>'status',
    p_marked_by,
    coalesce((rec->>'is_locked')::boolean, false)
  from jsonb_array_elements(p_records) rec
  where (rec->>'student_id')::uuid is not null
    and rec->>'status' in ('present', 'absent', 'late', 'leave', 'holiday')
  on conflict (student_id, class_group_id, attendance_date)
  do update set
    status = excluded.status,
    marked_by = excluded.marked_by,
    is_locked = excluded.is_locked,
    section_id = excluded.section_id,
    updated_at = now();

  -- Get number of affected rows (inserted + updated)
  get diagnostics v_affected = row_count;

  return json_build_object(
    'success', true,
    'affected', v_affected
  );

exception
  when others then
    v_error_message = sqlerrm;
    return json_build_object(
      'success', false,
      'error', v_error_message,
      'affected', 0
    );
end;
$$;

-- Add comment
comment on function mark_attendance_atomic is 
  'Atomically marks attendance for multiple students in a single transaction. Returns JSON with success status and affected row count.';

-- ============================================
-- Ensure Unique Constraint Exists
-- ============================================
-- The constraint should already exist from migration 1021
-- But we'll ensure it exists for safety

do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'ux_student_attendance_student_class_date'
  ) then
    alter table student_attendance
    add constraint ux_student_attendance_student_class_date 
    unique (student_id, class_group_id, attendance_date);
  end if;
end $$;

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the function was created:
--
-- SELECT 
--   proname as function_name,
--   pg_get_function_arguments(oid) as arguments,
--   pg_get_function_result(oid) as return_type
-- FROM pg_proc
-- WHERE proname = 'mark_attendance_atomic';
--
-- Test the function:
--
-- SELECT mark_attendance_atomic(
--   'school-uuid-here'::uuid,
--   'class-uuid-here'::uuid,
--   '2026-01-15'::date,
--   'user-uuid-here'::uuid,
--   '[
--     {"student_id": "student-uuid-1", "status": "present", "is_locked": false},
--     {"student_id": "student-uuid-2", "status": "absent", "is_locked": false}
--   ]'::jsonb
-- );
