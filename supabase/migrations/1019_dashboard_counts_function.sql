-- Migration: Add PostgreSQL function for dashboard counts aggregation
-- This function combines 4 separate count queries into a single query for better performance
-- Reduces network overhead and latency by using subqueries

-- ============================================
-- Function: get_dashboard_counts
-- ============================================
-- Returns all dashboard counts in a single query using subqueries
-- All computation happens in PostgreSQL, reducing network round trips
create or replace function get_dashboard_counts(
  p_school_id uuid
)
returns json as $$
declare
  v_result json;
begin
  -- Single query with subqueries to get all counts at once
  -- This is much more efficient than 4 separate queries
  select json_build_object(
    'total_students', (
      select count(*) 
      from students 
      where school_id = p_school_id 
        and status = 'active'
    ),
    'total_teachers', (
      select count(*) 
      from profiles 
      where school_id = p_school_id 
        and role in ('teacher', 'clerk') 
        and approval_status = 'approved'
    ),
    'total_classes', (
      select count(*) 
      from class_groups 
      where school_id = p_school_id
    ),
    'pending_approvals', (
      select count(*) 
      from profiles 
      where school_id = p_school_id 
        and role in ('teacher', 'clerk', 'student') 
        and approval_status = 'pending'
    )
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function get_dashboard_counts(uuid) to authenticated;

-- Add comment
comment on function get_dashboard_counts is 
  'Returns all dashboard counts in a single query using subqueries. Reduces network overhead from 4 queries to 1.';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
