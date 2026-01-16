-- Migration: Simplify Salary Payment Tracking
-- Purpose: Track salary payments directly without requiring salary record generation
--          Calculate unpaid months based on payments made vs expected salary

-- ============================================
-- 1. FIX TEACHER UNPAID SALARY MONTHS VIEW
-- ============================================
-- Calculate unpaid months based on payments, not salary records

drop view if exists teacher_unpaid_salary_months cascade;

create or replace view teacher_unpaid_salary_months as
with 
-- Get all active teachers with salary structure
active_teachers as (
  select distinct
    p.id as teacher_id,
    p.school_id,
    p.full_name,
    p.email,
    tss.id as salary_structure_id,
    tss.salary_cycle,
    tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary
  from profiles p
  inner join teacher_salary_structure tss on tss.teacher_id = p.id
  where p.role = 'teacher'
    and p.approval_status = 'approved'
    and p.school_id is not null
),
-- Generate expected months (last 12 months + current month)
expected_salary_months as (
  select 
    at.teacher_id,
    at.school_id,
    at.full_name,
    at.email,
    at.salary_structure_id,
    at.expected_salary,
    extract(month from generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::integer as month,
    extract(year from generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::integer as year,
    date_trunc('month', generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::date as period_start
  from active_teachers at
),
-- Get all payments and allocate them to months based on payment_date
monthly_payments as (
  select 
    tsp.teacher_id,
    extract(month from tsp.payment_date)::integer as month,
    extract(year from tsp.payment_date)::integer as year,
    sum(tsp.amount) as total_paid_amount
  from teacher_salary_payments tsp
  group by tsp.teacher_id, extract(month from tsp.payment_date), extract(year from tsp.payment_date)
)
select 
  esm.teacher_id,
  esm.school_id,
  esm.full_name as teacher_name,
  esm.email as teacher_email,
  esm.month,
  esm.year,
  esm.period_start,
  to_char(make_date(esm.year, esm.month, 1), 'Month YYYY') as period_label,
  esm.expected_salary as net_salary,
  coalesce(mp.total_paid_amount, 0) as paid_amount,
  esm.expected_salary - coalesce(mp.total_paid_amount, 0) as pending_amount,
  -- Determine payment status based on payments
  case 
    when coalesce(mp.total_paid_amount, 0) >= esm.expected_salary then 'paid'
    when coalesce(mp.total_paid_amount, 0) > 0 then 'partially-paid'
    else 'unpaid'
  end as payment_status,
  -- Get latest payment date for this month
  (select max(tsp.payment_date) 
   from teacher_salary_payments tsp 
   where tsp.teacher_id = esm.teacher_id
     and extract(month from tsp.payment_date) = esm.month
     and extract(year from tsp.payment_date) = esm.year
   limit 1) as payment_date,
  case 
    when coalesce(mp.total_paid_amount, 0) >= esm.expected_salary then false
    else true
  end as is_unpaid,
  -- Calculate days since period start (for overdue calculation)
  (current_date - esm.period_start)::integer as days_since_period_start
from expected_salary_months esm
left join monthly_payments mp on 
  mp.teacher_id = esm.teacher_id
  and mp.month = esm.month
  and mp.year = esm.year
where 
  -- Only show unpaid months (including partially paid)
  coalesce(mp.total_paid_amount, 0) < esm.expected_salary
order by esm.teacher_id, esm.year desc, esm.month desc;

-- ============================================
-- 2. FIX UNPAID TEACHERS SUMMARY VIEW
-- ============================================
-- Summary for principals and clerks to see unpaid teachers

drop view if exists unpaid_teachers_summary cascade;

create or replace view unpaid_teachers_summary as
select 
  school_id,
  teacher_id,
  teacher_name,
  teacher_email,
  count(*) as unpaid_months_count,
  sum(pending_amount) as total_unpaid_amount,
  max(days_since_period_start) as max_days_unpaid,
  min(period_start) as oldest_unpaid_month,
  max(period_start) as latest_unpaid_month,
  array_agg(distinct period_label order by period_label) as unpaid_months_list
from teacher_unpaid_salary_months
where is_unpaid = true
group by school_id, teacher_id, teacher_name, teacher_email
order by total_unpaid_amount desc, max_days_unpaid desc;

-- ============================================
-- 3. UPDATE COMMENTS
-- ============================================

comment on view teacher_unpaid_salary_months is 'Shows unpaid salary months based on payments made. No salary record generation required.';
comment on view unpaid_teachers_summary is 'Summary of unpaid teachers for principals and clerks. Based on payment tracking only.';

-- ============================================
-- 4. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
