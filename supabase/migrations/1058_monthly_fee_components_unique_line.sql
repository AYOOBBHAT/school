-- Enforce one row per student per calendar month per fee line (class/custom by category, transport by route).
-- Replaces UNIQUE(student_id, fee_category_id, period_year, period_month, fee_type) which allowed
-- multiple transport rows because fee_category_id is NULL (NULLs not distinct in unique constraints).

do $$
begin
  if exists (
    select 1
    from (
      select
        student_id,
        period_year,
        period_month,
        fee_type,
        coalesce(fee_category_id::text, '') as cat_key,
        coalesce(transport_route_id::text, '') as route_key,
        count(*)::int as n
      from monthly_fee_components
      group by 1, 2, 3, 4, 5, 6
      having count(*) > 1
    ) d
  ) then
    raise exception 'Duplicate monthly_fee_components rows detected; merge or delete duplicates before applying 1058';
  end if;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'monthly_fee_components'
      and c.contype = 'u'
  loop
    execute format('alter table monthly_fee_components drop constraint %I', r.conname);
  end loop;
end $$;

create unique index if not exists ux_monthly_fee_components_class_custom
  on monthly_fee_components (student_id, period_year, period_month, fee_type, fee_category_id)
  where fee_type in ('class-fee', 'custom-fee');

create unique index if not exists ux_monthly_fee_components_transport
  on monthly_fee_components (student_id, period_year, period_month, fee_type, transport_route_id)
  where fee_type = 'transport-fee';

comment on index ux_monthly_fee_components_class_custom is
  'One class/custom fee line per student per month (fee_category_id identifies the line).';

comment on index ux_monthly_fee_components_transport is
  'One transport fee line per student per month per route (transport_route_id).';
