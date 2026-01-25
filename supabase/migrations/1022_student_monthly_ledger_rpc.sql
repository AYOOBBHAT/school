-- Migration: Add PostgreSQL RPC for Student Monthly Ledger
-- Purpose: Move ledger aggregation from Node.js to database for better performance
-- Author: Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- Function: get_student_monthly_ledger
-- ============================================
-- Returns monthly fee ledger for a student with pagination and summary
-- All aggregation happens in the database - no Node.js processing needed

create or replace function get_student_monthly_ledger(
  p_school_id uuid,
  p_student_id uuid,
  p_start_year integer default null,
  p_end_year integer default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns json as $$
declare
  v_current_year integer;
  v_start_year integer;
  v_end_year integer;
  v_total_months integer;
  v_total_pages integer;
  v_month_names text[] := array['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  v_result json;
  v_data json[];
  v_summary json;
begin
  -- Set default year range if not provided
  v_current_year := extract(year from current_date)::integer;
  v_start_year := coalesce(p_start_year, v_current_year - 1);
  v_end_year := coalesce(p_end_year, v_current_year + 1);

  -- Get total count of distinct months (for pagination)
  select count(distinct (period_year, period_month))
  into v_total_months
  from monthly_fee_components
  where student_id = p_student_id
    and school_id = p_school_id
    and period_year >= v_start_year
    and period_year <= v_end_year;

  -- Calculate pagination
  v_total_pages := ceil(v_total_months::numeric / nullif(p_limit, 0))::integer;

  -- Get paginated months (most recent first)
  with distinct_months as (
    select distinct
      period_year,
      period_month
    from monthly_fee_components
    where student_id = p_student_id
      and school_id = p_school_id
      and period_year >= v_start_year
      and period_year <= v_end_year
    order by period_year desc, period_month desc
    limit p_limit
    offset p_offset
  ),
  -- Get components for paginated months with overdue calculation
  components_with_status as (
    select
      mfc.id,
      mfc.period_year,
      mfc.period_month,
      mfc.fee_type,
      mfc.fee_name,
      mfc.fee_amount,
      mfc.paid_amount,
      mfc.pending_amount,
      mfc.due_date,
      case
        when mfc.status in ('pending', 'partially-paid') 
          and mfc.due_date is not null 
          and mfc.due_date < current_date
        then 'overdue'
        else mfc.status
      end as status
    from monthly_fee_components mfc
    inner join distinct_months dm
      on mfc.period_year = dm.period_year
      and mfc.period_month = dm.period_month
    where mfc.student_id = p_student_id
      and mfc.school_id = p_school_id
    order by mfc.period_year desc, mfc.period_month desc, mfc.fee_type
  ),
  -- Group components by month
  grouped_by_month as (
    select
      period_year,
      period_month,
      json_agg(
        json_build_object(
          'id', id,
          'fee_type', fee_type,
          'fee_name', fee_name,
          'fee_amount', fee_amount,
          'paid_amount', paid_amount,
          'pending_amount', pending_amount,
          'status', status,
          'due_date', due_date
        )
        order by fee_type
      ) as components
    from components_with_status
    group by period_year, period_month
    order by period_year desc, period_month desc
  )
  -- Build final result array
  select json_agg(
    json_build_object(
      'month', v_month_names[period_month] || ' ' || period_year,
      'year', period_year,
      'monthNumber', period_month,
      'components', components
    )
  )
  into v_data
  from grouped_by_month;

  -- Calculate summary statistics
  select json_build_object(
    'total_components', count(*),
    'total_fee_amount', coalesce(sum(fee_amount), 0),
    'total_paid_amount', coalesce(sum(paid_amount), 0),
    'total_pending_amount', coalesce(sum(pending_amount), 0),
    'pending_count', count(*) filter (where status in ('pending', 'partially-paid', 'overdue')),
    'paid_count', count(*) filter (where status = 'paid')
  )
  into v_summary
  from monthly_fee_components
  where student_id = p_student_id
    and school_id = p_school_id
    and period_year >= v_start_year
    and period_year <= v_end_year;

  -- Build final result
  v_result := json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'pagination', json_build_object(
      'page', (p_offset / nullif(p_limit, 0))::integer + 1,
      'limit', p_limit,
      'total', v_total_months,
      'total_pages', v_total_pages
    ),
    'summary', coalesce(v_summary, '{}'::json)
  );

  return v_result;
end;
$$ language plpgsql security definer;

-- Add comment
comment on function get_student_monthly_ledger is 
  'Returns monthly fee ledger for a student with pagination and summary. All aggregation happens in the database.';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
