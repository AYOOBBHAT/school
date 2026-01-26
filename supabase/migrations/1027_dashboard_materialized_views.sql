-- Migration: Materialized Views for Dashboard and Analytics
-- Purpose: Precompute heavy aggregations to eliminate COUNT/SUM/GROUP BY queries during requests
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- PART 1: SCHOOL DASHBOARD SUMMARY
-- ============================================
-- Precomputes: total_students, total_staff, total_classes, pending_approvals
-- Replaces: get_dashboard_counts RPC function
-- Optimized: Uses subqueries instead of joins to avoid cartesian products

drop materialized view if exists mv_school_dashboard_summary;

create materialized view mv_school_dashboard_summary as
select
  s.id as school_id,

  -- Total active students (optimized subquery)
  coalesce((
    select count(*)
    from students st
    where st.school_id = s.id
      and st.status = 'active'
  ), 0) as total_students,

  -- Total approved staff (teachers + clerks) (optimized subquery)
  coalesce((
    select count(distinct p.id)
    from profiles p
    where p.school_id = s.id
      and p.role in ('teacher', 'clerk')
      and p.approval_status = 'approved'
  ), 0) as total_staff,

  -- Total classes (optimized subquery)
  coalesce((
    select count(*)
    from class_groups cg
    where cg.school_id = s.id
  ), 0) as total_classes,

  -- Pending approvals (teachers, clerks, students) (optimized subquery)
  coalesce((
    select count(distinct p2.id)
    from profiles p2
    where p2.school_id = s.id
      and p2.approval_status = 'pending'
      and p2.role in ('teacher', 'clerk', 'student')
  ), 0) as pending_approvals

from schools s;

-- Create unique index for fast lookups
create unique index on mv_school_dashboard_summary(school_id);

-- Add comment
comment on materialized view mv_school_dashboard_summary is 
  'Precomputed dashboard summary statistics per school. Refreshed periodically to avoid heavy aggregation queries.';

-- ============================================
-- PART 2: GENDER STATISTICS
-- ============================================
-- Precomputes: student and staff gender breakdowns
-- Replaces: get_dashboard_stats RPC function

drop materialized view if exists mv_school_gender_stats;

create materialized view mv_school_gender_stats as
with student_stats as (
  select
    s.school_id,
    count(*) as total,
    count(*) filter (
      where lower(trim(coalesce(p.gender, ''))) in ('male', 'm', 'boy', 'boys')
    ) as male,
    count(*) filter (
      where lower(trim(coalesce(p.gender, ''))) in ('female', 'f', 'girl', 'girls')
    ) as female,
    count(*) filter (
      where p.gender is not null 
        and trim(p.gender) != ''
        and lower(trim(p.gender)) not in ('male', 'm', 'boy', 'boys', 'female', 'f', 'girl', 'girls')
    ) as other,
    count(*) filter (
      where p.gender is null or trim(coalesce(p.gender, '')) = ''
    ) as unknown
  from students s
  left join profiles p on p.id = s.profile_id
  where s.status = 'active'
  group by s.school_id
),
staff_stats as (
  select
    school_id,
    count(*) as total,
    count(*) filter (
      where lower(trim(coalesce(gender, ''))) in ('male', 'm', 'boy', 'boys')
    ) as male,
    count(*) filter (
      where lower(trim(coalesce(gender, ''))) in ('female', 'f', 'girl', 'girls')
    ) as female,
    count(*) filter (
      where gender is not null 
        and trim(gender) != ''
        and lower(trim(gender)) not in ('male', 'm', 'boy', 'boys', 'female', 'f', 'girl', 'girls')
    ) as other,
    count(*) filter (
      where gender is null or trim(coalesce(gender, '')) = ''
    ) as unknown
  from profiles
  where role in ('principal', 'clerk', 'teacher')
    and approval_status = 'approved'
  group by school_id
)
select
  coalesce(ss.school_id, sts.school_id) as school_id,
  
  -- Student stats
  coalesce(ss.total, 0) as total_students,
  coalesce(ss.male, 0) as students_male,
  coalesce(ss.female, 0) as students_female,
  coalesce(ss.other, 0) as students_other,
  coalesce(ss.unknown, 0) as students_unknown,
  
  -- Staff stats
  coalesce(sts.total, 0) as total_staff,
  coalesce(sts.male, 0) as staff_male,
  coalesce(sts.female, 0) as staff_female,
  coalesce(sts.other, 0) as staff_other,
  coalesce(sts.unknown, 0) as staff_unknown

from student_stats ss
full outer join staff_stats sts on ss.school_id = sts.school_id;

-- Create unique index for fast lookups
create unique index on mv_school_gender_stats(school_id);

-- Add comment
comment on materialized view mv_school_gender_stats is 
  'Precomputed gender statistics for students and staff per school. Refreshed periodically.';

-- ============================================
-- PART 3: FEE UNPAID SUMMARY
-- ============================================
-- Precomputes: unpaid components count and total unpaid amount per school
-- Replaces: Heavy aggregation in get_unpaid_fee_analytics

drop materialized view if exists mv_fee_unpaid_summary;

create materialized view mv_fee_unpaid_summary as
select
  school_id,
  
  -- Count of unpaid components
  count(*) filter (where pending_amount > 0) as unpaid_components,
  
  -- Total unpaid amount
  sum(pending_amount) filter (where pending_amount > 0) as total_unpaid_amount,
  
  -- Additional stats for analytics
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (where status = 'partially-paid') as partially_paid_count,
  count(*) filter (where status = 'paid') as paid_count,
  count(*) filter (where status = 'overdue') as overdue_count,
  
  -- Total components
  count(*) as total_components

from monthly_fee_components
group by school_id;

-- Create unique index for fast lookups
create unique index on mv_fee_unpaid_summary(school_id);

-- Add comment
comment on materialized view mv_fee_unpaid_summary is 
  'Precomputed unpaid fee summary per school. Refreshed periodically to avoid heavy aggregation queries.';

-- ============================================
-- PART 4: REFRESH FUNCTION
-- ============================================
-- Function to refresh all materialized views concurrently (non-blocking)
-- Note: CONCURRENTLY requires unique indexes (already created above)

create or replace function refresh_dashboard_views()
returns void
language plpgsql
security definer
as $$
begin
  -- Refresh all views concurrently (non-blocking, allows reads during refresh)
  -- This is faster and doesn't block reads
  refresh materialized view concurrently mv_school_dashboard_summary;
  refresh materialized view concurrently mv_school_gender_stats;
  refresh materialized view concurrently mv_fee_unpaid_summary;
exception
  when others then
    -- If concurrent refresh fails (e.g., no unique index), fall back to blocking refresh
    raise notice 'Concurrent refresh failed, using blocking refresh: %', sqlerrm;
    refresh materialized view mv_school_dashboard_summary;
    refresh materialized view mv_school_gender_stats;
    refresh materialized view mv_fee_unpaid_summary;
end;
$$;

-- Add comment
comment on function refresh_dashboard_views is 
  'Refreshes all dashboard materialized views concurrently. Should be called periodically (every 1-5 minutes) via cron job.';

-- ============================================
-- PART 5: INITIAL DATA POPULATION
-- ============================================
-- NOTE: Initial refresh is commented out to avoid timeout during migration
-- Run these separately after migration completes:
-- 
-- Option 1: Run one at a time (recommended for large datasets):
--   refresh materialized view mv_school_dashboard_summary;
--   refresh materialized view mv_school_gender_stats;
--   refresh materialized view mv_fee_unpaid_summary;
--
-- Option 2: Use the refresh function (after indexes are created):
--   select refresh_dashboard_views();
--
-- Option 3: Run via separate migration file (see 1027a_populate_dashboard_views.sql)

-- ============================================
-- PART 6: REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify views were created:
--
-- SELECT * FROM mv_school_dashboard_summary WHERE school_id = 'your-school-uuid';
-- SELECT * FROM mv_school_gender_stats WHERE school_id = 'your-school-uuid';
-- SELECT * FROM mv_fee_unpaid_summary WHERE school_id = 'your-school-uuid';
--
-- To refresh manually:
-- SELECT refresh_dashboard_views();
--
-- To check view sizes:
-- SELECT 
--   schemaname,
--   matviewname,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
-- FROM pg_matviews
-- WHERE matviewname LIKE 'mv_%';
