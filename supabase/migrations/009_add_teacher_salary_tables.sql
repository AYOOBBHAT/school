-- Migration: Add teacher salary management tables
-- This enables salary structure, monthly salary records, and attendance-based deductions

-- Teacher Salary Structure: Base salary, allowances, deductions per teacher
create table if not exists teacher_salary_structure (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade,
  school_id uuid references schools(id),
  base_salary numeric not null default 0,
  hra numeric not null default 0, -- House Rent Allowance
  other_allowances numeric not null default 0,
  fixed_deductions numeric not null default 0, -- Loans, penalties, tax, etc.
  salary_cycle text check (salary_cycle in ('monthly', 'weekly', 'biweekly')) default 'monthly',
  attendance_based_deduction boolean default false, -- Enable/disable attendance-based deduction
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(teacher_id) -- One salary structure per teacher
);

-- Monthly Salary Records: Generated salary for each month
create table if not exists teacher_salary_records (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade,
  school_id uuid references schools(id),
  salary_structure_id uuid references teacher_salary_structure(id),
  month integer not null check (month >= 1 and month <= 12),
  year integer not null,
  gross_salary numeric not null default 0,
  total_deductions numeric not null default 0,
  attendance_deduction numeric not null default 0, -- Deduction due to absences
  net_salary numeric not null default 0,
  status text check (status in ('pending', 'approved', 'paid')) default 'pending',
  approved_by uuid references profiles(id),
  approved_at timestamp,
  payment_date date,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(teacher_id, month, year) -- One salary record per teacher per month
);

-- Enable Row Level Security
alter table teacher_salary_structure enable row level security;
alter table teacher_salary_records enable row level security;

-- Salary Structure Policies
drop policy if exists mt_salary_structure_select on teacher_salary_structure;
create policy mt_salary_structure_select on teacher_salary_structure
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  );

drop policy if exists mt_salary_structure_modify on teacher_salary_structure;
create policy mt_salary_structure_modify on teacher_salary_structure
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Salary Records Policies
drop policy if exists mt_salary_records_select on teacher_salary_records;
create policy mt_salary_records_select on teacher_salary_records
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  );

drop policy if exists mt_salary_records_modify on teacher_salary_records;
create policy mt_salary_records_modify on teacher_salary_records
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to auto-update updated_at
create trigger update_teacher_salary_structure_updated_at
  before update on teacher_salary_structure
  for each row
  execute function update_updated_at_column();

create trigger update_teacher_salary_records_updated_at
  before update on teacher_salary_records
  for each row
  execute function update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE teacher_salary_structure IS 'Salary structure for each teacher (base salary, allowances, deductions)';
COMMENT ON TABLE teacher_salary_records IS 'Monthly salary records for teachers with status (pending/approved/paid)';

