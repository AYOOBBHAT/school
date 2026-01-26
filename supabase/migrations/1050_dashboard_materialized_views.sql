-- Migration: Comprehensive Dashboard Materialized Views
-- Purpose: Move ALL dashboard + analytics queries from live aggregation to materialized views
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX
-- 
-- This migration creates materialized views for:
-- - School dashboard stats (students, teachers, clerks, classes)
-- - Attendance daily summary
-- - Fee collection summary
-- - Unpaid fees summary
-- - Salary summary
--
-- All views are refreshed via cron job every 3 minutes
-- NO runtime COUNT(*), SUM(), GROUP BY on large tables in Express routes

-- ============================================
-- PART 1: SCHOOL DASHBOARD STATS
-- ============================================
-- Principal dashboard: total students, teachers, clerks, classes
-- Replaces: Multiple COUNT queries in dashboard routes

drop materialized view if exists mv_school_dashboard_stats;

create materialized view mv_school_dashboard_stats as
select
  school_id,

  -- Count students (active only)
  (select count(*) from students s where s.school_id = p.school_id and s.status = 'active') as total_students,

  -- Count teachers (approved only)
  count(*) filter (where role = 'teacher' and approval_status = 'approved') as total_teachers,

  -- Count clerks (approved only)
  count(*) filter (where role = 'clerk' and approval_status = 'approved') as total_clerks,

  -- Total classes
  (select count(*) from class_groups cg where cg.school_id = p.school_id) as total_classes,

  now() as refreshed_at

from profiles p
where school_id is not null
group by school_id;

-- Create unique index for fast lookups
create unique index if not exists idx_mv_school_dashboard_stats_school
on mv_school_dashboard_stats(school_id);

-- Add comment
comment on materialized view mv_school_dashboard_stats is 
  'Precomputed school dashboard statistics. Refreshed every 3 minutes via cron.';

-- ============================================
-- PART 2: ATTENDANCE DAILY SUMMARY
-- ============================================
-- Daily attendance breakdown by status
-- Replaces: Heavy GROUP BY queries on student_attendance

drop materialized view if exists mv_attendance_daily_summary;

create materialized view mv_attendance_daily_summary as
select
  school_id,
  attendance_date,
  
  count(*) filter (where status = 'present') as present_count,
  count(*) filter (where status = 'absent') as absent_count,
  count(*) filter (where status = 'late') as late_count,
  count(*) filter (where status = 'leave') as leave_count,
  count(*) filter (where status = 'holiday') as holiday_count,
  
  count(*) as total_attendance,
  
  now() as refreshed_at

from student_attendance
where school_id is not null
group by school_id, attendance_date;

-- Create index for fast lookups (most recent first)
create index if not exists idx_mv_attendance_summary
on mv_attendance_daily_summary(school_id, attendance_date desc);

-- Add comment
comment on materialized view mv_attendance_daily_summary is 
  'Precomputed daily attendance summary by status. Refreshed every 3 minutes via cron.';

-- ============================================
-- PART 3: FEE COLLECTION SUMMARY
-- ============================================
-- Total collected fees and transaction count
-- Replaces: SUM() and COUNT() on monthly_fee_payments

drop materialized view if exists mv_fee_collection_summary;

create materialized view mv_fee_collection_summary as
select
  school_id,
  
  sum(payment_amount) as total_collected,
  count(*) as total_transactions,
  count(distinct student_id) as students_paid,
  count(distinct date_trunc('month', payment_date)) as months_with_payments,
  
  min(payment_date) as first_payment_date,
  max(payment_date) as last_payment_date,
  
  now() as refreshed_at

from monthly_fee_payments
where school_id is not null
group by school_id;

-- Create unique index for fast lookups
create unique index if not exists idx_mv_fee_summary_school
on mv_fee_collection_summary(school_id);

-- Add comment
comment on materialized view mv_fee_collection_summary is 
  'Precomputed fee collection summary. Refreshed every 3 minutes via cron.';

-- ============================================
-- PART 4: UNPAID FEES SUMMARY
-- ============================================
-- Total unpaid amount and component count
-- Replaces: Heavy aggregation on monthly_fee_components

drop materialized view if exists mv_unpaid_fee_summary;

create materialized view mv_unpaid_fee_summary as
select
  school_id,
  
  sum(pending_amount) filter (where pending_amount > 0) as total_unpaid,
  count(*) filter (where pending_amount > 0) as unpaid_components,
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (where status = 'partially-paid') as partially_paid_count,
  count(*) filter (where status = 'overdue') as overdue_count,
  count(distinct student_id) filter (where pending_amount > 0) as students_with_unpaid,
  
  now() as refreshed_at

from monthly_fee_components
where school_id is not null
group by school_id;

-- Create unique index for fast lookups
create unique index if not exists idx_mv_unpaid_fee_school
on mv_unpaid_fee_summary(school_id);

-- Add comment
comment on materialized view mv_unpaid_fee_summary is 
  'Precomputed unpaid fees summary. Refreshed every 3 minutes via cron.';

-- ============================================
-- PART 5: SALARY SUMMARY
-- ============================================
-- Total paid and pending salaries
-- Replaces: SUM() on teacher_salary_records

drop materialized view if exists mv_salary_summary;

create materialized view mv_salary_summary as
select
  school_id,
  
  sum(net_salary) filter (where status = 'paid') as total_paid,
  sum(net_salary) filter (where status = 'pending') as total_pending,
  sum(net_salary) filter (where status = 'approved') as total_approved,
  count(*) filter (where status = 'paid') as paid_records,
  count(*) filter (where status = 'pending') as pending_records,
  count(distinct teacher_id) filter (where status = 'pending') as teachers_with_pending,
  
  now() as refreshed_at

from teacher_salary_records
where school_id is not null
group by school_id;

-- Create unique index for fast lookups
create unique index if not exists idx_mv_salary_summary_school
on mv_salary_summary(school_id);

-- Add comment
comment on materialized view mv_salary_summary is 
  'Precomputed salary summary. Refreshed every 3 minutes via cron.';

-- ============================================
-- PART 6: REFRESH FUNCTION
-- ============================================
-- Function to refresh all materialized views concurrently

create or replace function refresh_dashboard_views()
returns void
language plpgsql
security definer
as $$
begin
  -- Refresh all views concurrently (non-blocking, allows reads during refresh)
  refresh materialized view concurrently mv_school_dashboard_stats;
  refresh materialized view concurrently mv_attendance_daily_summary;
  refresh materialized view concurrently mv_fee_collection_summary;
  refresh materialized view concurrently mv_unpaid_fee_summary;
  refresh materialized view concurrently mv_salary_summary;
exception
  when others then
    -- If concurrent refresh fails (e.g., no unique index), fall back to blocking refresh
    raise notice 'Concurrent refresh failed, using blocking refresh: %', sqlerrm;
    refresh materialized view mv_school_dashboard_stats;
    refresh materialized view mv_attendance_daily_summary;
    refresh materialized view mv_fee_collection_summary;
    refresh materialized view mv_unpaid_fee_summary;
    refresh materialized view mv_salary_summary;
end;
$$;

-- Add comment
comment on function refresh_dashboard_views is 
  'Refreshes all dashboard materialized views concurrently. Called every 3 minutes via cron job.';

-- ============================================
-- PART 7: RPC FUNCTION - GET DASHBOARD SNAPSHOT
-- ============================================
-- Single RPC call to fetch all dashboard data
-- Replaces: Multiple queries in Express routes

create or replace function get_school_dashboard_snapshot(p_school_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_build_object(
    'stats', (
      select row_to_json(ds)
      from mv_school_dashboard_stats ds
      where ds.school_id = p_school_id
    ),
    'attendance', (
      select row_to_json(att)
      from mv_attendance_daily_summary att
      where att.school_id = p_school_id
      order by att.attendance_date desc
      limit 1
    ),
    'fees', (
      select row_to_json(fc)
      from mv_fee_collection_summary fc
      where fc.school_id = p_school_id
    ),
    'unpaid', (
      select row_to_json(uf)
      from mv_unpaid_fee_summary uf
      where uf.school_id = p_school_id
    ),
    'salary', (
      select row_to_json(sal)
      from mv_salary_summary sal
      where sal.school_id = p_school_id
    )
  ) into v_result;

  return coalesce(v_result, '{}'::json);
end;
$$;

-- Add comment
comment on function get_school_dashboard_snapshot is 
  'Returns complete dashboard snapshot for a school in a single call. Reads from materialized views only.';

-- ============================================
-- PART 8: AUTO REFRESH VIA CRON
-- ============================================
-- Schedule automatic refresh every 3 minutes
-- Requires pg_cron extension (enable in Supabase dashboard)
-- Note: pg_cron may not be available on all Supabase plans

do $$
begin
  -- Try to enable pg_cron extension
  begin
    create extension if not exists pg_cron;
  exception
    when insufficient_privilege then
      raise notice 'pg_cron extension requires superuser privileges. Enable it in Supabase dashboard or use Node.js cron instead.';
    when others then
      raise notice 'Could not enable pg_cron: %. Set up Node.js cron or system cron instead.', sqlerrm;
  end;

  -- Try to schedule cron job
  begin
    -- Remove existing schedule if it exists
    if exists (select 1 from cron.job where jobname = 'refresh-dashboard-views') then
      perform cron.unschedule('refresh-dashboard-views');
    end if;

    -- Schedule refresh every 3 minutes
    -- Note: cron.schedule requires the SQL command as a text string
    perform cron.schedule(
      'refresh-dashboard-views',
      '*/3 * * * *', -- Every 3 minutes
      'SELECT refresh_dashboard_views();'
    );
    
    raise notice 'Cron job scheduled successfully. Views will refresh every 3 minutes.';
  exception
    when undefined_function then
      raise notice 'pg_cron functions not available. Set up Node.js cron or system cron instead. See DASHBOARD_MATERIALIZED_VIEWS_SETUP.md';
    when others then
      raise notice 'Could not schedule cron job: %. Set up Node.js cron or system cron instead.', sqlerrm;
  end;
end $$;

-- ============================================
-- PART 9: INITIAL DATA POPULATION
-- ============================================
-- NOTE: Initial refresh is commented out to avoid timeout during migration
-- Views will be populated by the cron job within 3 minutes
-- Or run manually: SELECT refresh_dashboard_views();

-- ============================================
-- PART 10: REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify views were created:
--
-- SELECT * FROM mv_school_dashboard_stats WHERE school_id = 'your-school-uuid';
-- SELECT * FROM mv_attendance_daily_summary WHERE school_id = 'your-school-uuid' ORDER BY attendance_date DESC LIMIT 5;
-- SELECT * FROM mv_fee_collection_summary WHERE school_id = 'your-school-uuid';
-- SELECT * FROM mv_unpaid_fee_summary WHERE school_id = 'your-school-uuid';
-- SELECT * FROM mv_salary_summary WHERE school_id = 'your-school-uuid';
--
-- Test RPC function:
-- SELECT get_school_dashboard_snapshot('your-school-uuid'::uuid);
--
-- To refresh manually:
-- SELECT refresh_dashboard_views();
--
-- To check cron schedule:
-- SELECT * FROM cron.job WHERE jobname = 'refresh-dashboard-views';
--
-- To check view sizes:
-- SELECT 
--   schemaname,
--   matviewname,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
-- FROM pg_matviews
-- WHERE matviewname LIKE 'mv_%';
