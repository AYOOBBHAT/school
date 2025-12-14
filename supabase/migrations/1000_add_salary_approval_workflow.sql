-- Migration: Add Salary Approval Workflow Fields
-- Enables comprehensive salary approval, rejection, and payment workflow
-- Adds audit logging and payment tracking

-- Step 1: Add rejection status and fields
alter table teacher_salary_records 
  add column if not exists rejection_reason text,
  add column if not exists payment_mode text check (payment_mode in ('bank', 'cash', 'upi')),
  add column if not exists payment_proof text, -- URL or file path to payment proof
  add column if not exists generated_by uuid references profiles(id), -- Who generated the salary
  add column if not exists paid_by uuid references profiles(id), -- Who marked as paid
  add column if not exists paid_at timestamp; -- When it was marked as paid

-- Step 2: Update status check constraint to include 'rejected'
alter table teacher_salary_records 
  drop constraint if exists teacher_salary_records_status_check;

alter table teacher_salary_records 
  add constraint teacher_salary_records_status_check 
  check (status in ('pending', 'approved', 'rejected', 'paid'));

-- Step 3: Update unique constraint to allow regeneration after rejection
-- Remove the unique constraint on (teacher_id, month, year)
alter table teacher_salary_records 
  drop constraint if exists teacher_salary_records_teacher_id_month_year_key;

-- Create partial unique index: only one non-rejected record per teacher per month
-- This allows regeneration after rejection while preventing duplicates
create unique index if not exists teacher_salary_records_unique_active 
  on teacher_salary_records(teacher_id, month, year) 
  where status != 'rejected';

-- Step 4: Add indexes for efficient querying
create index if not exists idx_teacher_salary_records_status 
  on teacher_salary_records(status, school_id);

create index if not exists idx_teacher_salary_records_generated_by 
  on teacher_salary_records(generated_by);

create index if not exists idx_teacher_salary_records_paid_by 
  on teacher_salary_records(paid_by);

-- Step 5: Add comments for documentation
comment on column teacher_salary_records.rejection_reason is 'Reason for rejection (if status is rejected)';
comment on column teacher_salary_records.payment_mode is 'Payment mode: bank, cash, or upi';
comment on column teacher_salary_records.payment_proof is 'URL or file path to payment proof document';
comment on column teacher_salary_records.generated_by is 'User who generated this salary record (audit)';
comment on column teacher_salary_records.paid_by is 'User who marked this salary as paid (audit)';
comment on column teacher_salary_records.paid_at is 'Timestamp when salary was marked as paid (audit)';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

