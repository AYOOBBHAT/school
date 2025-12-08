-- Migration: Add Monthly Fee Component Tracking for Clerk Fee Collection
-- This migration adds support for tracking individual fee components (Class Fee, Transport, Custom Fees) per month
-- and enables clerks to record payments against specific months and fee components

-- ============================================
-- 1. Create monthly_fee_components table
-- ============================================
-- This table tracks each fee component (Class Fee, Transport, Custom Fee) for each month
create table if not exists monthly_fee_components (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Fee component identification
  fee_category_id uuid references fee_categories(id) on delete cascade,
  fee_type text check (fee_type in ('class-fee', 'transport-fee', 'custom-fee')) not null,
  fee_name text not null, -- e.g., "Class Fee", "Transport - Route A", "Computer Lab Fee"
  
  -- Monthly period
  period_year integer not null,
  period_month integer not null check (period_month >= 1 and period_month <= 12),
  period_start date not null,
  period_end date not null,
  
  -- Fee details
  fee_amount numeric not null check (fee_amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time')) not null,
  
  -- Transport specific (if applicable)
  transport_route_id uuid references transport_routes(id) on delete set null,
  transport_route_name text,
  
  -- Payment tracking
  paid_amount numeric default 0 check (paid_amount >= 0),
  pending_amount numeric default 0 check (pending_amount >= 0),
  status text check (status in ('pending', 'partially-paid', 'paid', 'overdue')) default 'pending',
  
  -- Due date for this month
  due_date date,
  
  -- Link to bill if generated (tables removed in migration 012, keeping as UUID for future use)
  bill_id uuid,
  bill_item_id uuid,
  
  -- Metadata
  effective_from date, -- When this fee component started for student
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- One record per student per fee component per month
  unique(student_id, fee_category_id, period_year, period_month, fee_type)
);

-- Create indexes
create index if not exists idx_monthly_fee_components_student 
  on monthly_fee_components(student_id, period_year, period_month, status);
create index if not exists idx_monthly_fee_components_school 
  on monthly_fee_components(school_id);
create index if not exists idx_monthly_fee_components_status 
  on monthly_fee_components(student_id, status) 
  where status in ('pending', 'partially-paid', 'overdue');
create index if not exists idx_monthly_fee_components_due_date 
  on monthly_fee_components(due_date, status) 
  where status in ('pending', 'partially-paid', 'overdue');

-- ============================================
-- 2. Create monthly_fee_payments table
-- ============================================
-- This table tracks payments made against specific monthly fee components
create table if not exists monthly_fee_payments (
  id uuid primary key default uuid_generate_v4(),
  monthly_fee_component_id uuid references monthly_fee_components(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Payment details
  payment_amount numeric not null check (payment_amount > 0),
  payment_date date not null default current_date,
  payment_mode text check (payment_mode in ('cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer')) not null,
  transaction_id text, -- For online/UPI payments
  cheque_number text, -- For cheque payments
  bank_name text, -- For cheque/bank transfer
  
  -- Who collected
  received_by uuid references profiles(id) not null,
  
  -- Link to main fee_payments table if bill-based payment (table removed in migration 012, keeping as UUID for future use)
  fee_payment_id uuid,
  
  -- Receipt
  receipt_number text,
  
  -- Notes
  notes text,
  
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Create indexes
create index if not exists idx_monthly_fee_payments_component 
  on monthly_fee_payments(monthly_fee_component_id);
create index if not exists idx_monthly_fee_payments_student 
  on monthly_fee_payments(student_id, payment_date);
create index if not exists idx_monthly_fee_payments_school 
  on monthly_fee_payments(school_id);
create index if not exists idx_monthly_fee_payments_received_by 
  on monthly_fee_payments(received_by);

-- ============================================
-- 3. Function to update monthly fee component status
-- ============================================
create or replace function update_monthly_fee_component_status()
returns trigger as $$
begin
  -- Update the monthly_fee_component status based on payments
  update monthly_fee_components
  set 
    paid_amount = (
      select coalesce(sum(payment_amount), 0)
      from monthly_fee_payments
      where monthly_fee_component_id = coalesce(new.monthly_fee_component_id, old.monthly_fee_component_id)
    ),
    pending_amount = fee_amount - (
      select coalesce(sum(payment_amount), 0)
      from monthly_fee_payments
      where monthly_fee_component_id = coalesce(new.monthly_fee_component_id, old.monthly_fee_component_id)
    ),
    status = case
      when (
        select coalesce(sum(payment_amount), 0)
        from monthly_fee_payments
        where monthly_fee_component_id = coalesce(new.monthly_fee_component_id, old.monthly_fee_component_id)
      ) >= fee_amount then 'paid'
      when (
        select coalesce(sum(payment_amount), 0)
        from monthly_fee_payments
        where monthly_fee_component_id = coalesce(new.monthly_fee_component_id, old.monthly_fee_component_id)
      ) > 0 then 'partially-paid'
      when due_date < current_date then 'overdue'
      else 'pending'
    end,
    updated_at = now()
  where id = coalesce(new.monthly_fee_component_id, old.monthly_fee_component_id);
  
  return coalesce(new, old);
end;
$$ language plpgsql;

-- Trigger to update status on payment insert/update/delete
drop trigger if exists trigger_update_monthly_fee_component_status on monthly_fee_payments;
create trigger trigger_update_monthly_fee_component_status
  after insert or update or delete on monthly_fee_payments
  for each row execute function update_monthly_fee_component_status();

-- ============================================
-- 4. Function to generate receipt number
-- ============================================
create or replace function generate_receipt_number(school_uuid uuid)
returns text as $$
declare
  receipt_count integer;
  receipt_number text;
begin
  select count(*) + 1 into receipt_count
  from monthly_fee_payments
  where school_id = school_uuid
  and receipt_number is not null;
  
  receipt_number := 'RCP-' || to_char(current_date, 'YYYY') || '-' || 
                    lpad(receipt_count::text, 6, '0');
  
  return receipt_number;
end;
$$ language plpgsql;

-- ============================================
-- 5. Enable Row Level Security
-- ============================================
alter table monthly_fee_components enable row level security;
alter table monthly_fee_payments enable row level security;

-- RLS Policies for monthly_fee_components
drop policy if exists mt_monthly_fee_components_select on monthly_fee_components;
create policy mt_monthly_fee_components_select on monthly_fee_components
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg 
        where sg.student_id = monthly_fee_components.student_id 
        and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_monthly_fee_components_modify on monthly_fee_components;
create policy mt_monthly_fee_components_modify on monthly_fee_components
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- RLS Policies for monthly_fee_payments
drop policy if exists mt_monthly_fee_payments_select on monthly_fee_payments;
create policy mt_monthly_fee_payments_select on monthly_fee_payments
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg 
        where sg.student_id = monthly_fee_payments.student_id 
        and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_monthly_fee_payments_modify on monthly_fee_payments;
create policy mt_monthly_fee_payments_modify on monthly_fee_payments
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- 6. Add update timestamp triggers
-- ============================================
create trigger update_monthly_fee_components_updated_at
  before update on monthly_fee_components
  for each row
  execute function update_updated_at_column();

create trigger update_monthly_fee_payments_updated_at
  before update on monthly_fee_payments
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 7. Comments
-- ============================================
comment on table monthly_fee_components is 
  'Tracks individual fee components (Class Fee, Transport, Custom Fees) per month for each student';
comment on table monthly_fee_payments is 
  'Tracks payments made against specific monthly fee components';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

