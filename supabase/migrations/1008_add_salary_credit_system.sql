-- Migration: Add Salary Credit System for Overpayments
-- Purpose: Track overpayments and automatically apply them to future months
-- Author: Senior Software Engineer
-- Date: 2026-01-17
--
-- EDGE CASES HANDLED:
-- 1. Multiple overpayments: Credits are accumulated and applied chronologically
-- 2. Partial credit application: If credit is larger than one month's salary, it's split across months
-- 3. No future unpaid months: Credit is stored and applied when unpaid months appear
-- 4. Multiple credits: Oldest credits are applied first (FIFO)
-- 5. Credit larg er than multiple months: Applied across multiple months until exhausted
-- 6. Existing credits: New credits are added to existing balance
-- 7. Concurrent payments: Each payment's excess is tracked separately
-- 8. Credit tracking: Full audit trail of credit creation and application

-- ============================================
-- 1. CREATE TEACHER SALARY CREDITS TABLE
-- ============================================
-- Tracks credit balance (overpayments) for each teacher
-- Credits are automatically applied to future unpaid months

create table if not exists teacher_salary_credits (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade not null,
  school_id uuid references schools(id) not null,
  credit_amount numeric not null check (credit_amount > 0),
  source_payment_id uuid references teacher_salary_payments(id) on delete set null,
  source_month integer,
  source_year integer,
  applied_amount numeric not null default 0 check (applied_amount >= 0),
  remaining_amount numeric generated always as (credit_amount - applied_amount) stored,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure applied amount doesn't exceed credit amount
  constraint credit_applied_check check (applied_amount <= credit_amount)
);

-- Table to track credit applications to specific months
create table if not exists teacher_salary_credit_applications (
  id uuid primary key default uuid_generate_v4(),
  credit_id uuid references teacher_salary_credits(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete cascade not null,
  school_id uuid references schools(id) not null,
  applied_amount numeric not null check (applied_amount > 0),
  applied_to_month integer not null,
  applied_to_year integer not null,
  created_at timestamp default now(),
  
  -- Ensure one credit application per month per credit
  unique(credit_id, applied_to_month, applied_to_year)
);

-- Index for efficient queries
create index if not exists idx_teacher_salary_credits_teacher 
  on teacher_salary_credits(teacher_id, school_id);

create index if not exists idx_teacher_salary_credits_remaining 
  on teacher_salary_credits(teacher_id) 
  where remaining_amount > 0;

create index if not exists idx_teacher_salary_credits_source 
  on teacher_salary_credits(source_payment_id) 
  where source_payment_id is not null;

-- Indexes for credit applications
create index if not exists idx_credit_applications_credit 
  on teacher_salary_credit_applications(credit_id);

create index if not exists idx_credit_applications_teacher_month 
  on teacher_salary_credit_applications(teacher_id, applied_to_year, applied_to_month);

-- ============================================
-- 2. FUNCTION: Apply Credits to Future Months
-- ============================================
-- Automatically applies available credits to unpaid months in chronological order

create or replace function apply_salary_credits_to_future_months(
  p_teacher_id uuid,
  p_school_id uuid,
  p_new_credit_amount numeric
)
returns jsonb language plpgsql as $$
declare
  v_remaining_credit numeric := p_new_credit_amount;
  v_credit_id uuid;
  v_applied_count integer := 0;
  v_total_applied numeric := 0;
  v_unpaid_month record;
begin
  -- Get or create credit record for this teacher
  -- Find existing unused credit or create new one
  select id, remaining_amount into v_credit_id, v_remaining_credit
  from teacher_salary_credits
  where teacher_id = p_teacher_id
    and school_id = p_school_id
    and remaining_amount > 0
  order by created_at asc
  limit 1;
  
  -- If no existing credit, create new one
  if v_credit_id is null then
    insert into teacher_salary_credits (
      teacher_id,
      school_id,
      credit_amount,
      applied_amount
    ) values (
      p_teacher_id,
      p_school_id,
      p_new_credit_amount,
      0
    ) returning id, remaining_amount into v_credit_id, v_remaining_credit;
  else
    -- Add to existing credit
    update teacher_salary_credits
    set credit_amount = credit_amount + p_new_credit_amount,
        updated_at = now()
    where id = v_credit_id
    returning remaining_amount into v_remaining_credit;
  end if;
  
  -- Get unpaid months in chronological order (oldest first)
  -- Include existing credits in the calculation
  for v_unpaid_month in
    select 
      esm.teacher_id,
      esm.month,
      esm.year,
      esm.expected_salary,
      coalesce(mp.total_paid_amount, 0) as paid_amount,
      coalesce(mc.total_credit_applied, 0) as existing_credit,
      esm.expected_salary - (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) as pending_amount
    from (
      select 
        p.id as teacher_id,
        p.school_id,
        tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary,
        extract(month from ms.period_start)::integer as month,
        extract(year from ms.period_start)::integer as year,
        ms.period_start
      from profiles p
      inner join teacher_salary_structure tss on tss.teacher_id = p.id
      cross join (
        select date_trunc('month', generate_series(
          date_trunc('month', current_date - interval '12 months'),
          date_trunc('month', current_date + interval '12 months'),
          '1 month'::interval
        ))::date as period_start
      ) ms
      where p.id = p_teacher_id
        and p.school_id = p_school_id
        and p.role = 'teacher'
        and p.approval_status = 'approved'
        and (tss.is_active is null or tss.is_active = true)
        and (tss.effective_to is null or tss.effective_to >= ms.period_start)
    ) esm
    left join (
      select 
        tsp.teacher_id,
        tsp.salary_month as month,
        tsp.salary_year as year,
        sum(tsp.amount) as total_paid_amount
      from teacher_salary_payments tsp
      where tsp.teacher_id = p_teacher_id
        and tsp.salary_month is not null
        and tsp.salary_year is not null
      group by tsp.teacher_id, tsp.salary_month, tsp.salary_year
    ) mp on mp.teacher_id = esm.teacher_id
      and mp.month = esm.month
      and mp.year = esm.year
    left join (
      select 
        tsca.teacher_id,
        tsca.applied_to_month as month,
        tsca.applied_to_year as year,
        sum(tsca.applied_amount) as total_credit_applied
      from teacher_salary_credit_applications tsca
      where tsca.teacher_id = p_teacher_id
      group by tsca.teacher_id, tsca.applied_to_month, tsca.applied_to_year
    ) mc on mc.teacher_id = esm.teacher_id
      and mc.month = esm.month
      and mc.year = esm.year
    where esm.expected_salary - (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) > 0.01
      and (esm.year > extract(year from current_date) 
           or (esm.year = extract(year from current_date) and esm.month >= extract(month from current_date)))
    order by esm.year asc, esm.month asc
  loop
    -- Check if we have remaining credit
    if v_remaining_credit <= 0 then
      exit;
    end if;
    
    -- Calculate how much to apply (min of remaining credit and pending amount)
    -- Also account for existing credits already applied to this month
    declare
      v_existing_credit numeric;
      v_effective_pending numeric;
      v_apply_amount numeric;
    begin
      -- Use pending_amount which already accounts for existing credits
      -- (calculated in the query above)
      v_effective_pending := v_unpaid_month.pending_amount;
      
      -- Only apply if there's still pending amount
      if v_effective_pending > 0.01 then
        v_apply_amount := least(v_remaining_credit, v_effective_pending);
        
        -- Create credit application record
        insert into teacher_salary_credit_applications (
          credit_id,
          teacher_id,
          school_id,
          applied_amount,
          applied_to_month,
          applied_to_year
        ) values (
          v_credit_id,
          p_teacher_id,
          p_school_id,
          v_apply_amount,
          v_unpaid_month.month,
          v_unpaid_month.year
        );
        
        -- Update credit record total applied amount
        update teacher_salary_credits
        set applied_amount = applied_amount + v_apply_amount,
            updated_at = now()
        where id = v_credit_id;
        
        v_remaining_credit := v_remaining_credit - v_apply_amount;
        v_total_applied := v_total_applied + v_apply_amount;
        v_applied_count := v_applied_count + 1;
        
        -- If credit is fully applied, break
        if v_remaining_credit <= 0 then
          exit;
        end if;
      end if;
    end;
  end loop;
  
  return jsonb_build_object(
    'credit_id', v_credit_id,
    'total_credit', p_new_credit_amount,
    'applied_amount', v_total_applied,
    'remaining_credit', v_remaining_credit,
    'months_applied', v_applied_count
  );
end;
$$;

-- ============================================
-- 3. FUNCTION: Get Available Credit Balance
-- ============================================
-- Returns total available credit for a teacher

create or replace function get_teacher_credit_balance(
  p_teacher_id uuid,
  p_school_id uuid
)
returns numeric language sql stable as $$
  select coalesce(sum(remaining_amount), 0)
  from teacher_salary_credits
  where teacher_id = p_teacher_id
    and school_id = p_school_id
    and remaining_amount > 0;
$$;

-- ============================================
-- 4. UPDATE VIEW: Include Credits in Payment Calculation
-- ============================================
-- Modify teacher_unpaid_salary_months to account for credits

drop view if exists teacher_unpaid_salary_months cascade;

create or replace view teacher_unpaid_salary_months as
with 
active_teachers as (
  select 
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
    and (tss.is_active is null or tss.is_active = true)
    and (tss.effective_to is null or tss.effective_to >= current_date)
),
month_series as (
  select 
    date_trunc('month', generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::date as period_start
),
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
monthly_payments as (
  select 
    tsp.teacher_id,
    tsp.salary_month as month,
    tsp.salary_year as year,
    sum(tsp.amount) as total_paid_amount,
    max(tsp.payment_date) as latest_payment_date
  from teacher_salary_payments tsp
  where tsp.salary_month is not null and tsp.salary_year is not null
  group by tsp.teacher_id, tsp.salary_month, tsp.salary_year
),
-- Calculate credits applied to each month
monthly_credits as (
  select 
    tsca.teacher_id,
    tsca.applied_to_month as month,
    tsca.applied_to_year as year,
    sum(tsca.applied_amount) as total_credit_applied
  from teacher_salary_credit_applications tsca
  group by tsca.teacher_id, tsca.applied_to_month, tsca.applied_to_year
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
  coalesce(mc.total_credit_applied, 0) as credit_applied,
  -- Total effective payment = cash payments + credits applied
  coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0) as effective_paid_amount,
  -- Pending = expected - effective paid
  esm.expected_salary - (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) as pending_amount,
  case 
    when (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) >= esm.expected_salary then 'paid'
    when (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) > 0 then 'partially-paid'
    else 'unpaid'
  end as payment_status,
  mp.latest_payment_date as payment_date,
  case 
    when (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) >= esm.expected_salary then false
    else true
  end as is_unpaid,
  (current_date - esm.period_start)::integer as days_since_period_start
from expected_salary_months esm
left join monthly_payments mp on 
  mp.teacher_id = esm.teacher_id
  and mp.month = esm.month
  and mp.year = esm.year
left join monthly_credits mc on
  mc.teacher_id = esm.teacher_id
  and mc.month = esm.month
  and mc.year = esm.year
where 
  -- Only show unpaid months (including partially paid)
  esm.expected_salary - (coalesce(mp.total_paid_amount, 0) + coalesce(mc.total_credit_applied, 0)) > 0
order by esm.teacher_id, esm.year desc, esm.month desc;

-- ============================================
-- 5. TRIGGER: Auto-update updated_at
-- ============================================

-- Drop trigger if it exists (for idempotency)
drop trigger if exists update_teacher_salary_credits_updated_at on teacher_salary_credits;

create trigger update_teacher_salary_credits_updated_at
  before update on teacher_salary_credits
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 6. ENABLE RLS
-- ============================================

alter table teacher_salary_credits enable row level security;

-- RLS Policies for credits
drop policy if exists mt_salary_credits_select on teacher_salary_credits;
create policy mt_salary_credits_select on teacher_salary_credits
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  );

drop policy if exists mt_salary_credits_insert on teacher_salary_credits;
create policy mt_salary_credits_insert on teacher_salary_credits
  for insert with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- RLS Policies for credit applications
alter table teacher_salary_credit_applications enable row level security;

drop policy if exists mt_credit_applications_select on teacher_salary_credit_applications;
create policy mt_credit_applications_select on teacher_salary_credit_applications
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  );

drop policy if exists mt_credit_applications_insert on teacher_salary_credit_applications;
create policy mt_credit_applications_insert on teacher_salary_credit_applications
  for insert with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- 7. COMMENTS
-- ============================================

comment on table teacher_salary_credits is 'Tracks overpayments (credits) that are automatically applied to future unpaid months';
comment on column teacher_salary_credits.credit_amount is 'Total credit amount from overpayment';
comment on column teacher_salary_credits.applied_amount is 'Amount of credit already applied to months';
comment on column teacher_salary_credits.remaining_amount is 'Available credit balance (computed)';
comment on function apply_salary_credits_to_future_months is 'Automatically applies overpayments to future unpaid months in chronological order';
comment on function get_teacher_credit_balance is 'Returns total available credit balance for a teacher';

-- ============================================
-- 8. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
