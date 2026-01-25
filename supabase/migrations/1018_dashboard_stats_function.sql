-- Migration: Add PostgreSQL function for dashboard stats aggregation
-- This function moves all gender aggregation from Node.js to PostgreSQL for scalability
-- Supports filtering by school_id and returns aggregated gender counts

-- ============================================
-- Function: get_dashboard_stats
-- ============================================
-- Returns aggregated dashboard statistics including gender counts
-- All computation happens in PostgreSQL, not in Node.js
create or replace function get_dashboard_stats(
  p_school_id uuid
)
returns json as $$
declare
  v_result json;
begin
  -- Students gender aggregation
  -- Normalize gender values: male/m/boy/boys -> male, female/f/girl/girls -> female, others -> other, null -> unknown
  with student_gender_agg as (
    select
      case
        when lower(trim(coalesce(p.gender, ''))) in ('male', 'm', 'boy', 'boys') then 'male'
        when lower(trim(coalesce(p.gender, ''))) in ('female', 'f', 'girl', 'girls') then 'female'
        when p.gender is not null and trim(p.gender) != '' 
          and lower(trim(p.gender)) not in ('male', 'm', 'boy', 'boys', 'female', 'f', 'girl', 'girls') 
          then 'other'
        else 'unknown'
      end as normalized_gender,
      count(*) as count
    from students s
    left join profiles p on p.id = s.profile_id
    where s.school_id = p_school_id
      and s.status = 'active'
    group by normalized_gender
  ),
  -- Staff gender aggregation
  -- Normalize gender values: male/m/boy/boys -> male, female/f/girl/girls -> female, others -> other, null -> unknown
  staff_gender_agg as (
    select
      case
        when lower(trim(coalesce(gender, ''))) in ('male', 'm', 'boy', 'boys') then 'male'
        when lower(trim(coalesce(gender, ''))) in ('female', 'f', 'girl', 'girls') then 'female'
        when gender is not null and trim(gender) != '' 
          and lower(trim(gender)) not in ('male', 'm', 'boy', 'boys', 'female', 'f', 'girl', 'girls') 
          then 'other'
        else 'unknown'
      end as normalized_gender,
      count(*) as count
    from profiles
    where school_id = p_school_id
      and role in ('principal', 'clerk', 'teacher')
      and approval_status = 'approved'
    group by normalized_gender
  ),
  -- Transform student gender counts into object
  student_counts as (
    select json_build_object(
      'total', coalesce(sum(count), 0),
      'male', coalesce(sum(count) filter (where normalized_gender = 'male'), 0),
      'female', coalesce(sum(count) filter (where normalized_gender = 'female'), 0),
      'other', coalesce(sum(count) filter (where normalized_gender = 'other'), 0),
      'unknown', coalesce(sum(count) filter (where normalized_gender = 'unknown'), 0)
    ) as counts
    from student_gender_agg
  ),
  -- Transform staff gender counts into object
  staff_counts as (
    select json_build_object(
      'total', coalesce(sum(count), 0),
      'male', coalesce(sum(count) filter (where normalized_gender = 'male'), 0),
      'female', coalesce(sum(count) filter (where normalized_gender = 'female'), 0),
      'other', coalesce(sum(count) filter (where normalized_gender = 'other'), 0),
      'unknown', coalesce(sum(count) filter (where normalized_gender = 'unknown'), 0)
    ) as counts
    from staff_gender_agg
  ),
  -- Get total classes count
  classes_count as (
    select count(*) as total
    from class_groups
    where school_id = p_school_id
  )
  select json_build_object(
    'totalStudents', (select counts->>'total' from student_counts)::integer,
    'totalStaff', (select counts->>'total' from staff_counts)::integer,
    'totalClasses', (select total from classes_count),
    'studentsByGender', (select counts from student_counts),
    'staffByGender', (select counts from staff_counts)
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function get_dashboard_stats(uuid) to authenticated;

-- Add comment
comment on function get_dashboard_stats is 
  'Aggregates dashboard statistics including gender counts using database-side computation. Returns aggregated counts only, never full rows.';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
