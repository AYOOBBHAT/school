-- Migration: Add Payment History System for Teachers
-- Purpose: Comprehensive payment history tracking with payment types and running totals
-- Author: Senior Software Engineer
-- Date: 2026-01-17

-- ============================================
-- 1. ADD PAYMENT TYPE COLUMN
-- ============================================
-- Add payment_type to track different types of payments

alter table teacher_salary_payments
  add column if not exists payment_type text 
    check (payment_type in ('salary', 'advance', 'adjustment', 'bonus', 'loan', 'other'))
    default 'salary';

-- Update existing records to 'salary' if null
update teacher_salary_payments
set payment_type = 'salary'
where payment_type is null;

-- ============================================
-- 2. CREATE COMPREHENSIVE PAYMENT HISTORY VIEW
-- ============================================
-- View that includes all payment information with running totals

drop view if exists teacher_payment_history cascade;

create or replace view teacher_payment_history as
with payment_data as (
  select 
    tsp.id,
    tsp.teacher_id,
    tsp.school_id,
    tsp.payment_date,
    tsp.amount,
    tsp.payment_type,
    tsp.payment_mode,
    tsp.payment_proof,
    tsp.notes,
    tsp.salary_month,
    tsp.salary_year,
    tsp.paid_by,
    tsp.created_at,
    -- Teacher info
    p.full_name as teacher_name,
    p.email as teacher_email,
    -- Paid by info
    paid_by_p.full_name as paid_by_name,
    paid_by_p.email as paid_by_email,
    -- Month label
    case 
      when tsp.salary_month is not null and tsp.salary_year is not null
      then to_char(make_date(tsp.salary_year, tsp.salary_month, 1), 'Month YYYY')
      else null
    end as salary_period_label
  from teacher_salary_payments tsp
  inner join profiles p on p.id = tsp.teacher_id
  left join profiles paid_by_p on paid_by_p.id = tsp.paid_by
  where tsp.school_id is not null
),
-- Calculate running totals
payment_totals as (
  select 
    pd.*,
    -- Running total (sum of all payments up to this date)
    sum(pd.amount) over (
      partition by pd.teacher_id, pd.school_id 
      order by pd.payment_date asc, pd.created_at asc
      rows between unbounded preceding and current row
    ) as running_total,
    -- Total count of payments
    count(*) over (
      partition by pd.teacher_id, pd.school_id
    ) as total_payments_count
  from payment_data pd
)
select 
  pt.*,
  -- Payment type label
  case pt.payment_type
    when 'salary' then 'Monthly Salary'
    when 'advance' then 'Advance Payment'
    when 'adjustment' then 'Adjustment'
    when 'bonus' then 'Bonus'
    when 'loan' then 'Loan/Extra Payment'
    when 'other' then 'Other'
    else 'Salary'
  end as payment_type_label
from payment_totals pt
order by pt.teacher_id, pt.payment_date desc, pt.created_at desc;

-- ============================================
-- 3. CREATE PAYMENT SUMMARY FUNCTION
-- ============================================
-- Returns summary statistics for a teacher's payment history

create or replace function get_teacher_payment_summary(
  p_teacher_id uuid,
  p_school_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb language plpgsql stable as $$
declare
  v_summary jsonb;
  v_total_paid numeric;
  v_total_payments integer;
  v_by_type jsonb;
  v_by_mode jsonb;
  v_date_range jsonb;
begin
  -- Calculate totals
  select 
    coalesce(sum(amount), 0),
    count(*)
  into v_total_paid, v_total_payments
  from teacher_salary_payments
  where teacher_id = p_teacher_id
    and school_id = p_school_id
    and (p_start_date is null or payment_date >= p_start_date)
    and (p_end_date is null or payment_date <= p_end_date);
  
  -- Group by payment type
  select jsonb_object_agg(payment_type, type_total)
  into v_by_type
  from (
    select 
      payment_type,
      sum(amount) as type_total
    from teacher_salary_payments
    where teacher_id = p_teacher_id
      and school_id = p_school_id
      and (p_start_date is null or payment_date >= p_start_date)
      and (p_end_date is null or payment_date <= p_end_date)
    group by payment_type
  ) type_summary;
  
  -- Group by payment mode
  select jsonb_object_agg(payment_mode, mode_total)
  into v_by_mode
  from (
    select 
      payment_mode,
      sum(amount) as mode_total
    from teacher_salary_payments
    where teacher_id = p_teacher_id
      and school_id = p_school_id
      and (p_start_date is null or payment_date >= p_start_date)
      and (p_end_date is null or payment_date <= p_end_date)
    group by payment_mode
  ) mode_summary;
  
  -- Date range
  select jsonb_build_object(
    'first_payment_date',
    (select min(payment_date) from teacher_salary_payments 
     where teacher_id = p_teacher_id and school_id = p_school_id
     and (p_start_date is null or payment_date >= p_start_date)
     and (p_end_date is null or payment_date <= p_end_date)),
    'last_payment_date',
    (select max(payment_date) from teacher_salary_payments 
     where teacher_id = p_teacher_id and school_id = p_school_id
     and (p_start_date is null or payment_date >= p_start_date)
     and (p_end_date is null or payment_date <= p_end_date))
  ) into v_date_range;
  
  -- Build summary
  v_summary := jsonb_build_object(
    'total_paid', v_total_paid,
    'total_payments', v_total_payments,
    'average_payment', case when v_total_payments > 0 then v_total_paid / v_total_payments else 0 end,
    'by_type', coalesce(v_by_type, '{}'::jsonb),
    'by_mode', coalesce(v_by_mode, '{}'::jsonb),
    'date_range', coalesce(v_date_range, '{}'::jsonb)
  );
  
  return v_summary;
end;
$$;

-- ============================================
-- 4. ENABLE RLS ON VIEW
-- ============================================
-- Views inherit RLS from underlying tables, but we need to grant access

grant select on teacher_payment_history to authenticated;

-- ============================================
-- 5. COMMENTS
-- ============================================

comment on column teacher_salary_payments.payment_type is 
'Type of payment: salary (regular monthly), advance (future month), adjustment (correction), bonus (extra), loan (borrowed/extra), other';

comment on view teacher_payment_history is 
'Comprehensive payment history view with running totals, payment types, and all payment details. 
Includes teacher info, paid_by info, and chronological ordering.';

comment on function get_teacher_payment_summary is 
'Returns payment summary statistics including totals, counts, breakdowns by type and mode, and date range.';

-- ============================================
-- 6. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
