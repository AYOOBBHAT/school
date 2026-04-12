-- One-time backfill: clone Jan 2026 monthly_fee_components → Feb, Mar, Apr 2026
-- For rows that do not already exist (idempotent). Testing / gap recovery when cron never ran.
-- Prefer regeneration from fee structure (cron / CLI / analytics ensure) instead of copying
-- previous months for production correctness.
-- Does NOT touch analytics RPCs or views.

-- February 2026
insert into monthly_fee_components (
  student_id,
  school_id,
  fee_category_id,
  fee_type,
  fee_name,
  period_year,
  period_month,
  period_start,
  period_end,
  fee_amount,
  fee_cycle,
  transport_route_id,
  transport_route_name,
  paid_amount,
  pending_amount,
  status,
  due_date,
  bill_id,
  bill_item_id,
  effective_from
)
select
  m.student_id,
  m.school_id,
  m.fee_category_id,
  m.fee_type,
  m.fee_name,
  2026,
  2,
  date '2026-02-01',
  date '2026-02-28',
  m.fee_amount,
  m.fee_cycle,
  m.transport_route_id,
  m.transport_route_name,
  0::numeric,
  m.fee_amount,
  'pending',
  date '2026-02-15',
  null,
  null,
  m.effective_from
from monthly_fee_components m
where m.period_year = 2026
  and m.period_month = 1
  and not exists (
    select 1
    from monthly_fee_components e
    where e.student_id = m.student_id
      and e.school_id = m.school_id
      and e.period_year = 2026
      and e.period_month = 2
      and e.fee_type = m.fee_type
      and e.fee_category_id is not distinct from m.fee_category_id
  );

-- March 2026
insert into monthly_fee_components (
  student_id,
  school_id,
  fee_category_id,
  fee_type,
  fee_name,
  period_year,
  period_month,
  period_start,
  period_end,
  fee_amount,
  fee_cycle,
  transport_route_id,
  transport_route_name,
  paid_amount,
  pending_amount,
  status,
  due_date,
  bill_id,
  bill_item_id,
  effective_from
)
select
  m.student_id,
  m.school_id,
  m.fee_category_id,
  m.fee_type,
  m.fee_name,
  2026,
  3,
  date '2026-03-01',
  date '2026-03-31',
  m.fee_amount,
  m.fee_cycle,
  m.transport_route_id,
  m.transport_route_name,
  0::numeric,
  m.fee_amount,
  'pending',
  date '2026-03-15',
  null,
  null,
  m.effective_from
from monthly_fee_components m
where m.period_year = 2026
  and m.period_month = 1
  and not exists (
    select 1
    from monthly_fee_components e
    where e.student_id = m.student_id
      and e.school_id = m.school_id
      and e.period_year = 2026
      and e.period_month = 3
      and e.fee_type = m.fee_type
      and e.fee_category_id is not distinct from m.fee_category_id
  );

-- April 2026
insert into monthly_fee_components (
  student_id,
  school_id,
  fee_category_id,
  fee_type,
  fee_name,
  period_year,
  period_month,
  period_start,
  period_end,
  fee_amount,
  fee_cycle,
  transport_route_id,
  transport_route_name,
  paid_amount,
  pending_amount,
  status,
  due_date,
  bill_id,
  bill_item_id,
  effective_from
)
select
  m.student_id,
  m.school_id,
  m.fee_category_id,
  m.fee_type,
  m.fee_name,
  2026,
  4,
  date '2026-04-01',
  date '2026-04-30',
  m.fee_amount,
  m.fee_cycle,
  m.transport_route_id,
  m.transport_route_name,
  0::numeric,
  m.fee_amount,
  'pending',
  date '2026-04-15',
  null,
  null,
  m.effective_from
from monthly_fee_components m
where m.period_year = 2026
  and m.period_month = 1
  and not exists (
    select 1
    from monthly_fee_components e
    where e.student_id = m.student_id
      and e.school_id = m.school_id
      and e.period_year = 2026
      and e.period_month = 4
      and e.fee_type = m.fee_type
      and e.fee_category_id is not distinct from m.fee_category_id
  );

notify pgrst, 'reload schema';
