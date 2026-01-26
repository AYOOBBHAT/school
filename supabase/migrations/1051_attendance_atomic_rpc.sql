-- Migration: Atomic Attendance Marking RPC (Simplified)
-- Purpose: Move attendance writes to PostgreSQL for atomic operations
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX
--
-- This function uses DELETE + INSERT pattern for idempotent operations
-- All writes happen in a single transaction

-- ============================================
-- RPC Function: mark_student_attendance_atomic
-- ============================================

create or replace function mark_student_attendance_atomic(
  p_school_id uuid,
  p_class_group_id uuid,
  p_attendance_date date,
  p_marked_by uuid,
  p_records jsonb
)
returns json
language plpgsql
security definer
as $$
declare
  v_count int := 0;
  v_error_message text;
begin
  -- Validate input
  if p_school_id is null or p_class_group_id is null or p_attendance_date is null 
     or p_marked_by is null or p_records is null then
    return json_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  end if;

  if jsonb_array_length(p_records) = 0 then
    return json_build_object(
      'success', false,
      'error', 'No attendance records provided'
    );
  end if;

  -- Transaction automatically handled by function
  -- Delete existing attendance for same class/date (idempotent)
  delete from student_attendance
  where school_id = p_school_id
    and class_group_id = p_class_group_id
    and attendance_date = p_attendance_date;

  -- Bulk insert from json
  insert into student_attendance(
    student_id,
    class_group_id,
    school_id,
    attendance_date,
    status,
    marked_by,
    is_locked
  )
  select
    (rec->>'student_id')::uuid,
    p_class_group_id,
    p_school_id,
    p_attendance_date,
    rec->>'status',
    p_marked_by,
    coalesce((rec->>'is_locked')::boolean, false)
  from jsonb_array_elements(p_records) rec
  where (rec->>'student_id')::uuid is not null
    and rec->>'status' in ('present', 'absent', 'late', 'leave', 'holiday');

  get diagnostics v_count = row_count;

  return json_build_object(
    'success', true,
    'inserted', v_count
  );

exception
  when others then
    v_error_message := sqlerrm;
    return json_build_object(
      'success', false,
      'error', v_error_message,
      'inserted', 0
    );
end;
$$;

-- Add comment
comment on function mark_student_attendance_atomic is 
  'Atomically marks attendance for multiple students. Uses DELETE + INSERT pattern for idempotent operations. All writes in single transaction.';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Test the function:
--
-- SELECT mark_student_attendance_atomic(
--   'school-uuid'::uuid,
--   'class-uuid'::uuid,
--   '2026-01-15'::date,
--   'user-uuid'::uuid,
--   '[
--     {"student_id": "student-uuid-1", "status": "present", "is_locked": false},
--     {"student_id": "student-uuid-2", "status": "absent", "is_locked": false}
--   ]'::jsonb
-- );
