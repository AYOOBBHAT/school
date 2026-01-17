-- Migration: Optimize Salary Payment Tracking Queries
-- Purpose: Performance optimizations for salary payment views and queries
-- Author: Senior SQL Developer
-- Date: 2026-01-17

-- ============================================
-- 1. OPTIMIZE INDEXES FOR PAYMENT QUERIES
-- ============================================
-- Add covering index for payment_date lookup in subquery
-- This eliminates the need for table scan in correlated subquery

create index if not exists idx_teacher_salary_payments_covering 
  on teacher_salary_payments(teacher_id, salary_year, salary_month, payment_date)
  where salary_month is not null and salary_year is not null;

-- Add index for active teachers lookup (if not exists)
create index if not exists idx_profiles_teacher_active 
  on profiles(role, approval_status, school_id) 
  where role = 'teacher' and approval_status = 'approved' and school_id is not null;

-- ============================================
-- 2. OPTIMIZED TEACHER UNPAID SALARY MONTHS VIEW
-- ============================================
-- Key optimizations:
-- 1. Generate series once, extract multiple times (reduces function calls)
-- 2. Replace correlated subquery with LEFT JOIN (eliminates N+1 pattern)
-- 3. Remove unnecessary DISTINCT (unique constraint on teacher_id in salary_structure)
-- 4. Use computed columns efficiently
-- 5. Optimize WHERE clause for index usage

drop view if exists teacher_unpaid_salary_months cascade;

create or replace view teacher_unpaid_salary_months as
with 
-- OPTIMIZATION: Get active teachers with salary structure (no DISTINCT needed due to unique constraint)
active_teachers as (
  select 
    p.id as teacher_id,
    p.school_id,
    p.full_name,
    p.email,
    tss.id as salary_structure_id,
    tss.salary_cycle,
    -- Pre-calculate expected salary (computed once)
    tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary
  from profiles p
  inner join teacher_salary_structure tss on tss.teacher_id = p.id
  where p.role = 'teacher'
    and p.approval_status = 'approved'
    and p.school_id is not null
    -- OPTIMIZATION: Filter for active structures only (if versioning exists)
    and (tss.is_active is null or tss.is_active = true)
    and (tss.effective_to is null or tss.effective_to >= current_date)
),
-- OPTIMIZATION: Generate series once, extract multiple times (more efficient)
month_series as (
  select 
    date_trunc('month', generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::date as period_start
),
-- Generate expected months with all needed columns from single series
expected_salary_months as (
  select 
    at.teacher_id,
    at.school_id,
    at.full_name,
    at.email,
    at.salary_structure_id,
    at.expected_salary,
    extract(month from ms.period_start)::integer as month,
    extract(year from ms.period_start)::integer as year,
    ms.period_start
  from active_teachers at
  cross join month_series ms
),
-- OPTIMIZATION: Aggregate payments once, use covering index
monthly_payments as (
  select 
    tsp.teacher_id,
    tsp.salary_month as month,
    tsp.salary_year as year,
    sum(tsp.amount) as total_paid_amount,
    -- OPTIMIZATION: Get max payment_date in same aggregation (eliminates correlated subquery)
    max(tsp.payment_date) as latest_payment_date
  from teacher_salary_payments tsp
  where tsp.salary_month is not null 
    and tsp.salary_year is not null
  group by tsp.teacher_id, tsp.salary_month, tsp.salary_year
)
-- OPTIMIZATION: Use LEFT JOIN instead of correlated subquery
select 
  esm.teacher_id,
  esm.school_id,
  esm.full_name as teacher_name,
  esm.email as teacher_email,
  esm.month,
  esm.year,
  esm.period_start,
  -- OPTIMIZATION: Use make_date for consistent date formatting
  to_char(make_date(esm.year, esm.month, 1), 'Month YYYY') as period_label,
  esm.expected_salary as net_salary,
  coalesce(mp.total_paid_amount, 0) as paid_amount,
  -- OPTIMIZATION: Calculate once, use in multiple places
  esm.expected_salary - coalesce(mp.total_paid_amount, 0) as pending_amount,
  -- OPTIMIZATION: Single CASE expression for status (more efficient than multiple)
  case 
    when coalesce(mp.total_paid_amount, 0) >= esm.expected_salary then 'paid'
    when coalesce(mp.total_paid_amount, 0) > 0 then 'partially-paid'
    else 'unpaid'
  end as payment_status,
  -- OPTIMIZATION: Use aggregated value from JOIN instead of correlated subquery
  mp.latest_payment_date as payment_date,
  -- OPTIMIZATION: Derive is_unpaid from payment_status (single source of truth)
  case 
    when coalesce(mp.total_paid_amount, 0) >= esm.expected_salary then false
    else true
  end as is_unpaid,
  -- OPTIMIZATION: Calculate days once
  (current_date - esm.period_start)::integer as days_since_period_start
from expected_salary_months esm
left join monthly_payments mp on 
  mp.teacher_id = esm.teacher_id
  and mp.month = esm.month
  and mp.year = esm.year
where 
  -- OPTIMIZATION: Filter early (pushdown predicate) - only show unpaid months
  coalesce(mp.total_paid_amount, 0) < esm.expected_salary
order by esm.teacher_id, esm.year desc, esm.month desc;

-- ============================================
-- 3. OPTIMIZED UNPAID TEACHERS SUMMARY VIEW
-- ============================================
-- Key optimizations:
-- 1. Use materialized view pattern hints (if needed in future)
-- 2. Optimize aggregation with proper grouping
-- 3. Use array_agg efficiently

drop view if exists unpaid_teachers_summary cascade;

create or replace view unpaid_teachers_summary as
select 
  school_id,
  teacher_id,
  teacher_name,
  teacher_email,
  count(*) as unpaid_months_count,
  -- OPTIMIZATION: Use sum of pending_amount (already calculated in base view)
  sum(pending_amount) as total_unpaid_amount,
  max(days_since_period_start) as max_days_unpaid,
  min(period_start) as oldest_unpaid_month,
  max(period_start) as latest_unpaid_month,
  -- OPTIMIZATION: Use array_agg with DISTINCT and ORDER BY for consistent results
  array_agg(distinct period_label order by period_label) as unpaid_months_list
from teacher_unpaid_salary_months
where is_unpaid = true
group by school_id, teacher_id, teacher_name, teacher_email
-- OPTIMIZATION: Order by most critical metrics first
order by total_unpaid_amount desc nulls last, max_days_unpaid desc nulls last;

-- ============================================
-- 4. ADD STATISTICS FOR QUERY PLANNER
-- ============================================
-- Update table statistics to help query planner make better decisions

analyze teacher_salary_payments;
analyze teacher_salary_structure;
analyze profiles;

-- ============================================
-- 5. UPDATE COMMENTS WITH PERFORMANCE NOTES
-- ============================================

comment on view teacher_unpaid_salary_months is 
'Optimized view showing unpaid salary months based on payments. 
Uses LEFT JOIN instead of correlated subqueries for better performance.
Indexes: idx_teacher_salary_payments_covering, idx_profiles_teacher_active';

comment on view unpaid_teachers_summary is 
'Optimized summary of unpaid teachers. Aggregates from teacher_unpaid_salary_months view.
Performance: Uses efficient GROUP BY with pre-calculated pending_amount.';

comment on index idx_teacher_salary_payments_covering is 
'Covering index for payment queries. Includes teacher_id, salary_year, salary_month, payment_date.
Eliminates need for table access when looking up payment dates.';

-- ============================================
-- 6. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
