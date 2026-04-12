-- Fix get_unpaid_fee_analytics: non-overlapping paid/unpaid/partial buckets,
-- period overlap filter, cohort = students with components in range only.

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
  with student_period_aggregated as (
    select
      s.id as student_id,
      p.full_name as student_name,
      s.roll_number,
      cg.name as class_name,
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
      coalesce(sum(mfc.pending_amount), 0) as total_pending,
      coalesce(sum(mfc.fee_amount), 0) as total_fee,
      coalesce(sum(mfc.paid_amount), 0) as total_paid,
      count(*) filter (where mfc.pending_amount > 0) as pending_months,
      case
        when coalesce(sum(mfc.pending_amount), 0) = 0 then 'paid'
        when coalesce(sum(mfc.paid_amount), 0) > 0 then 'partially-paid'
        else 'unpaid'
      end as payment_status
    from students s
    inner join monthly_fee_components mfc on mfc.student_id = s.id
    left join profiles p on p.id = s.profile_id
    left join class_groups cg on cg.id = s.class_group_id
    where s.school_id = p_school_id
      and s.status = 'active'
      and (p_class_group_id is null or s.class_group_id = p_class_group_id)
      and (
        p_start_date is null
        or (
          mfc.period_start <= coalesce(p_end_date, current_date)
          and mfc.period_end >= p_start_date
        )
      )
    group by s.id, p.full_name, s.roll_number, cg.name
  ),
  total_count_cte as (
    select count(*)::bigint as total
    from student_period_aggregated
  ),
  summary_stats as (
    select
      count(*)::bigint as total_students,
      count(*) filter (
        where spa.total_pending > 0 and spa.total_paid = 0
      )::bigint as unpaid_count,
      count(*) filter (
        where spa.total_pending > 0 and spa.total_paid > 0
      )::bigint as partially_paid_count,
      count(*) filter (
        where spa.total_pending = 0
      )::bigint as paid_count
    from student_period_aggregated spa
  )
  select json_build_object(
    'students', (
      select json_agg(
        json_build_object(
          'student_id', spa.student_id,
          'student_name', spa.student_name,
          'roll_number', spa.roll_number,
          'class_name', spa.class_name,
          'parent_name', coalesce((spa.guardian_info->>'full_name')::text, spa.student_name),
          'parent_phone', coalesce((spa.guardian_info->>'phone')::text, ''),
          'parent_address', coalesce((spa.guardian_info->>'address')::text, ''),
          'pending_months', spa.pending_months,
          'total_pending', spa.total_pending,
          'total_fee', spa.total_fee,
          'total_paid', spa.total_paid,
          'payment_status', spa.payment_status
        )
        order by spa.total_pending desc, spa.student_name asc nulls last
      )
      from student_period_aggregated spa
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
        'paid_count', ss.paid_count,
        'total_unpaid_amount', (
          select coalesce(sum(spa.total_pending), 0)
          from student_period_aggregated spa
        )
      )
      from summary_stats ss
    )
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

grant execute on function get_unpaid_fee_analytics(uuid, uuid, date, date, integer, integer) to authenticated;

comment on function get_unpaid_fee_analytics is
  'Fee analytics: cohort = students with monthly_fee_components overlapping the date range. Paid/unpaid/partially-paid are mutually exclusive per aggregated totals.';

notify pgrst, 'reload schema';
