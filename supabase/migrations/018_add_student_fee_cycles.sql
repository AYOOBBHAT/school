-- Migration: Add per-student fee cycles and period tracking
-- This enables different students in the same class to have different fee cycles

-- ============================================
-- 1. STUDENT FEE CYCLES (Per-student cycle configuration)
-- ============================================
create table if not exists student_fee_cycles (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Fee cycle configuration
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time')) not null,
  
  -- Effective date range
  effective_from date not null, -- When this cycle starts
  effective_to date, -- NULL means currently active
  
  -- Optional: Override class fees for specific categories
  -- If NULL, uses class default; if set, uses this cycle for that category
  fee_category_id uuid references fee_categories(id) on delete set null,
  
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Partial unique index: One active cycle per student per category (or global if category is NULL)
create unique index student_fee_cycles_active_unique 
  on student_fee_cycles(student_id, fee_category_id) 
  where is_active = true;

-- Index for fast lookups
create index idx_student_fee_cycles_student 
  on student_fee_cycles(student_id, is_active) 
  where is_active = true;

-- ============================================
-- 2. FEE BILL PERIODS (Track billing periods per student)
-- ============================================
create table if not exists fee_bill_periods (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  bill_id uuid references fee_bills(id) on delete set null, -- NULL if not yet billed
  
  -- Period identification
  period_type text check (period_type in ('monthly', 'quarterly', 'yearly', 'one-time')) not null,
  period_year integer not null,
  period_month integer, -- 1-12 for monthly/quarterly, NULL for yearly/one-time
  period_quarter integer, -- 1-4 for quarterly, NULL for others
  
  -- Period dates
  period_start date not null,
  period_end date not null,
  
  -- Status
  status text check (status in ('pending', 'billed', 'partially-paid', 'paid', 'overdue', 'waived')) default 'pending',
  
  -- Amounts
  expected_amount numeric default 0 check (expected_amount >= 0),
  paid_amount numeric default 0 check (paid_amount >= 0),
  balance_amount numeric default 0 check (balance_amount >= 0),
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- One period per student per time period
  unique(student_id, period_type, period_year, period_month, period_quarter)
);

-- Index for fast lookups
create index idx_fee_bill_periods_student_status 
  on fee_bill_periods(student_id, status) 
  where status in ('pending', 'billed', 'partially-paid', 'overdue');

create index idx_fee_bill_periods_student_period 
  on fee_bill_periods(student_id, period_year, period_month, period_quarter);

create index idx_fee_bill_periods_dates 
  on fee_bill_periods(period_start, period_end);

-- ============================================
-- 3. Add period_id to fee_bills
-- ============================================
alter table fee_bills 
  add column if not exists period_id uuid references fee_bill_periods(id) on delete set null;

create index idx_fee_bills_period on fee_bills(period_id);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
alter table student_fee_cycles enable row level security;
alter table fee_bill_periods enable row level security;

-- ============================================
-- RLS Policies - Student Fee Cycles
-- ============================================
drop policy if exists mt_student_fee_cycles_select on student_fee_cycles;
create policy mt_student_fee_cycles_select on student_fee_cycles
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_cycles.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_cycles_modify on student_fee_cycles;
create policy mt_student_fee_cycles_modify on student_fee_cycles
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Fee Bill Periods
-- ============================================
drop policy if exists mt_fee_bill_periods_select on fee_bill_periods;
create policy mt_fee_bill_periods_select on fee_bill_periods
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = fee_bill_periods.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_fee_bill_periods_modify on fee_bill_periods;
create policy mt_fee_bill_periods_modify on fee_bill_periods
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- Triggers
-- ============================================
create trigger update_student_fee_cycles_updated_at
  before update on student_fee_cycles
  for each row
  execute function update_updated_at_column();

create trigger update_fee_bill_periods_updated_at
  before update on fee_bill_periods
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Function: Update period status when bill status changes
-- ============================================
create or replace function update_period_status_from_bill()
returns trigger language plpgsql as $$
begin
  if new.period_id is not null then
    update fee_bill_periods
    set 
      status = new.status,
      paid_amount = (select coalesce(sum(amount_paid), 0) from fee_payments where bill_id = new.id),
      balance_amount = new.net_amount - (select coalesce(sum(amount_paid), 0) from fee_payments where bill_id = new.id)
    where id = new.period_id;
  end if;
  return new;
end;
$$;

create trigger update_period_on_bill_change
  after update of status, net_amount on fee_bills
  for each row
  execute function update_period_status_from_bill();

-- ============================================
-- Function: Mark periods as overdue
-- ============================================
create or replace function mark_overdue_periods()
returns void language plpgsql as $$
begin
  update fee_bill_periods p
  set status = 'overdue'
  from fee_bills b
  where p.bill_id = b.id
    and p.status in ('billed', 'partially-paid')
    and b.due_date < current_date
    and b.net_amount > (select coalesce(sum(amount_paid), 0) from fee_payments where bill_id = b.id);
end;
$$;

-- ============================================
-- Comments
-- ============================================
comment on table student_fee_cycles is 'Per-student fee cycle configuration (monthly/quarterly/yearly/one-time)';
comment on table fee_bill_periods is 'Tracks billing periods per student for payment tracking and pending/overdue calculations';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

