-- Migration: Simplified Teacher Salary Management System
-- Removes monthly salary generation workflow and replaces with flexible payment tracking
-- Principal creates salary structures, Clerk records payments (full/partial/advance)

-- Step 1: Create teacher_salary_payments table for flexible payment tracking
create table if not exists teacher_salary_payments (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade not null,
  school_id uuid references schools(id) not null,
  payment_date date not null,
  amount numeric not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('bank', 'cash', 'upi')),
  payment_proof text, -- URL or file path to payment proof
  notes text,
  paid_by uuid references profiles(id) not null, -- Clerk who recorded the payment
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Step 2: Create index for efficient queries
create index if not exists idx_teacher_salary_payments_teacher 
  on teacher_salary_payments(teacher_id, school_id, payment_date);

create index if not exists idx_teacher_salary_payments_school 
  on teacher_salary_payments(school_id, payment_date);

create index if not exists idx_teacher_salary_payments_paid_by 
  on teacher_salary_payments(paid_by);

-- Step 3: Enable Row Level Security
alter table teacher_salary_payments enable row level security;

-- Step 4: RLS Policies for teacher_salary_payments

-- Select policy: Principal, Clerk can see all; Teacher can see own
drop policy if exists mt_salary_payments_select on teacher_salary_payments;
create policy mt_salary_payments_select on teacher_salary_payments
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  );

-- Insert policy: Only Clerk can record payments
drop policy if exists mt_salary_payments_insert on teacher_salary_payments;
create policy mt_salary_payments_insert on teacher_salary_payments
  for insert with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'clerk'
    and paid_by = auth.uid()
  );

-- Update policy: Only Clerk can update payments (for corrections)
drop policy if exists mt_salary_payments_update on teacher_salary_payments;
create policy mt_salary_payments_update on teacher_salary_payments
  for update using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'clerk'
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'clerk'
  );

-- Delete policy: Only Principal can delete payments (for corrections)
drop policy if exists mt_salary_payments_delete on teacher_salary_payments;
create policy mt_salary_payments_delete on teacher_salary_payments
  for delete using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'principal'
  );

-- Step 5: Update RLS policies for teacher_salary_structure
-- Only Principal can create/update salary structures

drop policy if exists mt_salary_structure_modify on teacher_salary_structure;
create policy mt_salary_structure_modify on teacher_salary_structure
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'principal'
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'principal'
  );

-- Step 6: Function to calculate total salary due for a teacher
-- Calculates based on salary structure effective dates and salary cycle
-- Counts complete periods (months/weeks/biweeks) from effective_from to as_of_date
create or replace function calculate_teacher_salary_due(
  p_teacher_id uuid,
  p_school_id uuid,
  p_as_of_date date default current_date
)
returns numeric
language plpgsql
stable
as $$
declare
  v_total_due numeric := 0;
  v_structure_record record;
  v_start_date date;
  v_end_date date;
  v_months_count integer;
  v_weeks_count integer;
  v_salary_per_period numeric;
  v_effective_from date;
  v_effective_to date;
begin
  -- Get all salary structures in chronological order
  for v_structure_record in
    select 
      id,
      base_salary,
      hra,
      other_allowances,
      fixed_deductions,
      salary_cycle,
      effective_from,
      effective_to,
      is_active
    from teacher_salary_structure
    where teacher_id = p_teacher_id
      and school_id = p_school_id
      and effective_from <= p_as_of_date
    order by effective_from
  loop
    -- Determine effective period for this structure
    v_effective_from := v_structure_record.effective_from;
    
    -- If this structure has an effective_to date, use the earlier of that or p_as_of_date
    if v_structure_record.effective_to is not null and v_structure_record.effective_to < p_as_of_date then
      v_effective_to := v_structure_record.effective_to;
    else
      v_effective_to := p_as_of_date;
    end if;
    
    -- Calculate net salary per period (base + allowances - deductions)
    v_salary_per_period := v_structure_record.base_salary 
      + v_structure_record.hra 
      + v_structure_record.other_allowances 
      - v_structure_record.fixed_deductions;
    
    -- Calculate salary based on cycle
    if v_structure_record.salary_cycle = 'monthly' then
      -- Count calendar months: Count distinct year-month combinations between dates (inclusive)
      -- This gives accurate monthly salary calculation
      v_months_count := (
        (extract(year from v_effective_to)::integer - extract(year from v_effective_from)::integer) * 12 +
        extract(month from v_effective_to)::integer - extract(month from v_effective_from)::integer + 1
      );
      -- Ensure at least 1 month
      if v_months_count < 1 then
        v_months_count := 1;
      end if;
      v_total_due := v_total_due + (v_salary_per_period * v_months_count);
      
    elsif v_structure_record.salary_cycle = 'weekly' then
      -- Count complete weeks (7 days = 1 week)
      v_weeks_count := ((v_effective_to - v_effective_from)::integer / 7) + 1;
      if v_weeks_count < 1 then
        v_weeks_count := 1;
      end if;
      v_total_due := v_total_due + (v_salary_per_period * v_weeks_count);
      
    elsif v_structure_record.salary_cycle = 'biweekly' then
      -- Count complete biweeks (14 days = 1 biweek)
      v_weeks_count := ((v_effective_to - v_effective_from)::integer / 14) + 1;
      if v_weeks_count < 1 then
        v_weeks_count := 1;
      end if;
      v_total_due := v_total_due + (v_salary_per_period * v_weeks_count);
      
    else
      -- Default to monthly calculation
      v_months_count := (
        (extract(year from v_effective_to)::integer - extract(year from v_effective_from)::integer) * 12 +
        extract(month from v_effective_to)::integer - extract(month from v_effective_from)::integer + 1
      );
      if v_months_count < 1 then
        v_months_count := 1;
      end if;
      v_total_due := v_total_due + (v_salary_per_period * v_months_count);
    end if;
  end loop;
  
  return coalesce(v_total_due, 0);
end;
$$;

-- Step 7: Function to calculate total salary paid for a teacher
create or replace function calculate_teacher_salary_paid(
  p_teacher_id uuid,
  p_school_id uuid,
  p_as_of_date date default current_date
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount), 0)
  from teacher_salary_payments
  where teacher_id = p_teacher_id
    and school_id = p_school_id
    and payment_date <= p_as_of_date;
$$;

-- Step 8: Function to calculate pending salary (due - paid)
create or replace function calculate_teacher_salary_pending(
  p_teacher_id uuid,
  p_school_id uuid,
  p_as_of_date date default current_date
)
returns numeric
language sql
stable
as $$
  select 
    calculate_teacher_salary_due(p_teacher_id, p_school_id, p_as_of_date) 
    - calculate_teacher_salary_paid(p_teacher_id, p_school_id, p_as_of_date);
$$;

-- Step 9: Create view for teacher salary summary
create or replace view teacher_salary_summary as
select 
  p.id as teacher_id,
  p.full_name as teacher_name,
  p.email as teacher_email,
  p.school_id,
  calculate_teacher_salary_due(p.id, p.school_id) as total_salary_due,
  calculate_teacher_salary_paid(p.id, p.school_id) as total_salary_paid,
  calculate_teacher_salary_pending(p.id, p.school_id) as pending_salary,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', tss.id,
        'base_salary', tss.base_salary,
        'hra', tss.hra,
        'other_allowances', tss.other_allowances,
        'fixed_deductions', tss.fixed_deductions,
        'salary_cycle', tss.salary_cycle,
        'effective_from', tss.effective_from,
        'effective_to', tss.effective_to,
        'is_active', tss.is_active
      ) order by tss.effective_from desc
    )
    from teacher_salary_structure tss
    where tss.teacher_id = p.id
      and tss.school_id = p.school_id
  ) as salary_structures
from profiles p
where p.role = 'teacher'
  and p.school_id is not null;

-- Step 10: Enable RLS on the view (it will use underlying table policies)
-- Note: Views inherit RLS from underlying tables, but we need to grant access
grant select on teacher_salary_summary to authenticated;

-- Step 11: Add trigger to update updated_at timestamp
create trigger update_teacher_salary_payments_updated_at
  before update on teacher_salary_payments
  for each row
  execute function update_updated_at_column();

-- Step 12: Add comments for documentation
comment on table teacher_salary_payments is 'Flexible salary payment tracking - supports full, partial, and advance payments';
comment on column teacher_salary_payments.payment_date is 'Date when payment was made';
comment on column teacher_salary_payments.amount is 'Payment amount (can be full, partial, or advance)';
comment on column teacher_salary_payments.payment_mode is 'Payment method: bank, cash, or upi';
comment on column teacher_salary_payments.paid_by is 'Clerk who recorded this payment';

comment on function calculate_teacher_salary_due is 'Calculates total salary due for a teacher based on salary structure and effective dates';
comment on function calculate_teacher_salary_paid is 'Calculates total salary paid for a teacher up to a given date';
comment on function calculate_teacher_salary_pending is 'Calculates pending salary (due - paid) for a teacher';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

