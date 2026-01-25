-- Migration: Add PostgreSQL function for unpaid fee analytics aggregation
-- This function moves all heavy computation from Node.js to PostgreSQL for scalability
-- Supports filtering by school_id, class_group_id, and date range with pagination

-- ============================================
-- Function: get_unpaid_fee_analytics
-- ============================================
-- Returns aggregated unpaid fee data for students with pagination
-- All computation happens in PostgreSQL, not in Node.js
create or replace function get_unpaid_fee_analytics(
  p_school_id uuid,
  p_class_group_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page_limit integer default 20,
  p_page_offset integer default 0
)
returns json as $$
declare
  v_result json;
begin
  -- Get paginated student unpaid fee data with aggregations
  -- Only includes students with pending_amount > 0
  with student_unpaid_aggregated as (
    select
      s.id as student_id,
      p.full_name as student_name,
      s.roll_number,
      cg.name as class_name,
      -- Get primary guardian info (first guardian found)
      (
        select json_build_object(
          'full_name', pg.full_name,
          'phone', pg.phone,
          'address', pg.address
        )
        from student_guardians sg
        join profiles pg on pg.id = sg.guardian_profile_id
        where sg.student_id = s.id
        limit 1
      ) as guardian_info,
      -- Aggregations
      sum(mfc.pending_amount) as total_pending,
      sum(mfc.fee_amount) as total_fee,
      sum(mfc.paid_amount) as total_paid,
      count(*) filter (where mfc.pending_amount > 0) as pending_months,
      -- Payment status: 'paid', 'unpaid', or 'partially-paid'
      case
        when sum(mfc.pending_amount) = 0 then 'paid'
        when sum(mfc.paid_amount) > 0 then 'partially-paid'
        else 'unpaid'
      end as payment_status
    from students s
    join monthly_fee_components mfc on mfc.student_id = s.id
    left join profiles p on p.id = s.profile_id
    left join class_groups cg on cg.id = s.class_group_id
    where s.school_id = p_school_id
      and s.status = 'active'
      and mfc.pending_amount > 0
      and (p_class_group_id is null or s.class_group_id = p_class_group_id)
      and (
        p_start_date is null or 
        (mfc.period_start >= p_start_date and mfc.period_end <= coalesce(p_end_date, current_date))
      )
    group by s.id, p.full_name, s.roll_number, cg.name
    having sum(mfc.pending_amount) > 0  -- Only students with unpaid fees
  ),
  -- Get total count for pagination
  total_count_cte as (
    select count(*) as total
    from student_unpaid_aggregated
  ),
  -- Get summary statistics (all students, not just unpaid)
  summary_stats as (
    select
      count(distinct s.id) filter (where s.status = 'active') as total_students,
      count(distinct s.id) filter (
        where s.status = 'active'
        and exists (
          select 1
          from monthly_fee_components mfc2
          where mfc2.student_id = s.id
            and mfc2.pending_amount > 0
            and (p_start_date is null or 
                 (mfc2.period_start >= p_start_date and mfc2.period_end <= coalesce(p_end_date, current_date)))
        )
      ) as unpaid_count,
      count(distinct s.id) filter (
        where s.status = 'active'
        and exists (
          select 1
          from monthly_fee_components mfc2
          where mfc2.student_id = s.id
            and mfc2.pending_amount > 0
            and mfc2.paid_amount > 0
            and (p_start_date is null or 
                 (mfc2.period_start >= p_start_date and mfc2.period_end <= coalesce(p_end_date, current_date)))
        )
      ) as partially_paid_count
    from students s
    where s.school_id = p_school_id
      and (p_class_group_id is null or s.class_group_id = p_class_group_id)
  )
  select json_build_object(
    'students', (
      select json_agg(
        json_build_object(
          'student_id', sua.student_id,
          'student_name', sua.student_name,
          'roll_number', sua.roll_number,
          'class_name', sua.class_name,
          'parent_name', coalesce((sua.guardian_info->>'full_name')::text, sua.student_name),
          'parent_phone', coalesce((sua.guardian_info->>'phone')::text, ''),
          'parent_address', coalesce((sua.guardian_info->>'address')::text, ''),
          'pending_months', sua.pending_months,
          'total_pending', sua.total_pending,
          'total_fee', sua.total_fee,
          'total_paid', sua.total_paid,
          'payment_status', sua.payment_status
        )
        order by sua.total_pending desc
      )
      from student_unpaid_aggregated sua
      limit p_page_limit
      offset p_page_offset
    ),
    'pagination', (
      select json_build_object(
        'page', (p_page_offset / nullif(p_page_limit, 0)) + 1,
        'limit', p_page_limit,
        'total', (select total from total_count_cte),
        'total_pages', ceil((select total from total_count_cte)::numeric / nullif(p_page_limit, 1))
      )
    ),
    'summary', (
      select json_build_object(
        'total_students', ss.total_students,
        'unpaid_count', ss.unpaid_count,
        'partially_paid_count', ss.partially_paid_count,
        'paid_count', ss.total_students - ss.unpaid_count - ss.partially_paid_count,
        'total_unpaid_amount', (
          select coalesce(sum(total_pending), 0)
          from student_unpaid_aggregated
        )
      )
      from summary_stats ss
    )
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function get_unpaid_fee_analytics(uuid, uuid, date, date, integer, integer) to authenticated;

-- Add comment
comment on function get_unpaid_fee_analytics is 
  'Aggregates unpaid fee data for students using database-side computation. Returns paginated results with summary statistics.';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
