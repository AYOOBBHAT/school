-- Migration: Add salary_month and salary_year to teacher_salary_payments
-- Purpose: Allow clerks to explicitly specify which month/year the payment is for

-- Step 1: Add salary_month and salary_year columns
alter table teacher_salary_payments
  add column if not exists salary_month integer check (salary_month >= 1 and salary_month <= 12),
  add column if not exists salary_year integer;

-- Step 2: For existing records, populate month/year from payment_date
-- Only update if columns don't exist yet (for fresh installs, this will be no-op)
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'teacher_salary_payments' 
    and column_name = 'payment_date'
  ) then
    update teacher_salary_payments
    set 
      salary_month = extract(month from payment_date)::integer,
      salary_year = extract(year from payment_date)::integer
    where salary_month is null or salary_year is null;
  end if;
end $$;

-- Step 3: Make salary_month and salary_year required for new records
-- We'll use a check constraint to ensure they're set
-- Drop constraint if it exists first
alter table teacher_salary_payments
  drop constraint if exists teacher_salary_payments_month_year_check;

alter table teacher_salary_payments
  add constraint teacher_salary_payments_month_year_check 
  check (salary_month is not null and salary_year is not null);

-- Step 4: Add index for efficient queries by salary month/year
create index if not exists idx_teacher_salary_payments_month_year 
  on teacher_salary_payments(teacher_id, salary_year, salary_month);

-- Step 5: Add comment
comment on column teacher_salary_payments.salary_month is 'Month (1-12) for which this salary payment is made';
comment on column teacher_salary_payments.salary_year is 'Year for which this salary payment is made';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
