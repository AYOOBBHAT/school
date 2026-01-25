-- Migration: Teacher Salary Summary RPC Function
-- Purpose: Replace Promise.all loop with single database aggregation
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- Function: get_teacher_salary_summaries
-- ============================================
-- Returns salary summaries for multiple teachers in a single query
-- Replaces N+1 queries (Promise.all loop) with one database call

create or replace function get_teacher_salary_summaries(
  p_school_id uuid,
  p_teacher_ids uuid[] default null
)
returns json as $$
declare
  v_result json;
begin
  -- Single query to get all summaries
  -- Uses CTEs for clarity and performance
  with teacher_salaries as (
    select
      p.id as teacher_id,
      p.full_name as teacher_name,
      p.email as teacher_email,
      -- Calculate totals using subqueries (optimized with indexes)
      (
        select coalesce(sum(final_salary), 0)
        from teacher_salary_records tsr
        where tsr.teacher_id = p.id
          and tsr.school_id = p_school_id
          and tsr.status in ('approved', 'paid')
      ) as total_salary_due,
      (
        select coalesce(sum(payment_amount), 0)
        from teacher_salary_payments tsp
        where tsp.teacher_id = p.id
          and tsp.school_id = p_school_id
      ) as total_salary_paid,
      -- Get active salary structure
      (
        select row_to_json(ss.*)
        from teacher_salary_structure ss
        where ss.teacher_id = p.id
          and ss.school_id = p_school_id
          and ss.is_active = true
          and ss.effective_to is null
        order by ss.effective_from desc
        limit 1
      ) as current_structure,
      -- Get recent salary structures (last 10)
      (
        select json_agg(row_to_json(ss.*) order by ss.effective_from desc)
        from (
          select *
          from teacher_salary_structure
          where teacher_id = p.id
            and school_id = p_school_id
          order by effective_from desc
          limit 10
        ) ss
      ) as salary_structures
    from profiles p
    where p.school_id = p_school_id
      and p.role in ('teacher', 'clerk')
      and p.approval_status = 'approved'
      and (p_teacher_ids is null or p.id = any(p_teacher_ids))
  )
  select json_agg(
    json_build_object(
      'teacher', json_build_object(
        'id', teacher_id,
        'full_name', teacher_name,
        'email', teacher_email
      ),
      'total_salary_due', total_salary_due,
      'total_salary_paid', total_salary_paid,
      'pending_salary', greatest(0, total_salary_due - total_salary_paid),
      'current_structure', current_structure,
      'salary_structures', coalesce(salary_structures, '[]'::json)
    )
  )
  into v_result
  from teacher_salaries;

  return coalesce(v_result, '[]'::json);
end;
$$ language plpgsql security definer;

-- Add comment
comment on function get_teacher_salary_summaries is 
  'Returns salary summaries for teachers. Replaces N+1 queries with single database aggregation.';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
