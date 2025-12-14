-- Migration: Add Salary Structure Versioning
-- Enables effective date-based salary structure versioning for teachers
-- Similar to fee structure versioning, allows principal to edit salary with effective dates
-- Old salary structures remain unchanged for past months

-- Step 1: Add versioning columns to teacher_salary_structure
alter table teacher_salary_structure 
  add column if not exists effective_from date default current_date,
  add column if not exists effective_to date,
  add column if not exists is_active boolean default true;

-- Step 2: Update existing records to have effective_from = created_at (or current_date)
-- and mark them as active
update teacher_salary_structure
set 
  effective_from = coalesce(created_at::date, current_date),
  effective_to = null,
  is_active = true
where effective_from is null;

-- Step 3: Remove the unique constraint on teacher_id since we now allow multiple versions
-- (one per effective date range)
alter table teacher_salary_structure 
  drop constraint if exists teacher_salary_structure_teacher_id_key;

-- Step 4: Create partial unique index to ensure only one active structure per teacher
-- at any point in time
create unique index if not exists teacher_salary_structure_unique_active 
  on teacher_salary_structure(teacher_id) 
  where is_active = true and effective_to is null;

-- Step 5: Create index for efficient querying by date ranges
create index if not exists idx_teacher_salary_structure_dates 
  on teacher_salary_structure(teacher_id, effective_from, effective_to, is_active);

-- Step 6: Add comments for documentation
comment on column teacher_salary_structure.effective_from is 'Date from which this salary structure is effective';
comment on column teacher_salary_structure.effective_to is 'Date until which this salary structure is effective (NULL = currently active)';
comment on column teacher_salary_structure.is_active is 'Whether this salary structure version is currently active';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

