-- Migration: Fix Fee Management Issues
-- 1. Make fee_category_id optional in class_fee_defaults (class fee is just for a class)
-- 2. Fix optional_fee_definitions to use 'amount' instead of 'default_amount'
-- 3. Fix students RLS policy recursion
-- 4. Add name field to optional_fee_definitions for easier identification

-- ============================================
-- 1. Make fee_category_id optional in class_fee_defaults
-- ============================================
alter table class_fee_defaults
  alter column fee_category_id drop not null,
  drop constraint if exists class_fee_defaults_class_group_id_fee_category_id_fee_cycle_effective_from_key,
  add constraint class_fee_defaults_class_group_id_fee_cycle_effective_from_key 
    unique(class_group_id, fee_cycle, effective_from, coalesce(fee_category_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Add name field to class_fee_defaults for easier identification
alter table class_fee_defaults
  add column if not exists name text;

-- ============================================
-- 2. Fix optional_fee_definitions - ensure it has name and uses amount
-- ============================================
-- Add name field if it doesn't exist
alter table optional_fee_definitions
  add column if not exists name text;

-- Ensure amount column exists (it should, but check)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'optional_fee_definitions' 
    and column_name = 'amount'
  ) then
    alter table optional_fee_definitions add column amount numeric;
    -- Migrate from default_amount if it exists
    if exists (
      select 1 from information_schema.columns 
      where table_name = 'optional_fee_definitions' 
      and column_name = 'default_amount'
    ) then
      update optional_fee_definitions set amount = default_amount where amount is null;
    end if;
  end if;
end $$;

-- ============================================
-- 3. Fix students RLS policy to prevent recursion
-- ============================================
-- The issue is likely in policies that reference students table
-- Let's check and fix any policies that might cause recursion

-- Drop and recreate students select policy to avoid recursion
drop policy if exists mt_students_select on students;
create policy mt_students_select on students
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or profile_id = auth.uid()
      or exists (
        select 1 from student_guardians sg 
        where sg.student_id = students.id 
        and sg.guardian_profile_id = auth.uid()
      )
    )
  );

-- ============================================
-- 4. Update class_fee_defaults to not require fee_category
-- ============================================
comment on column class_fee_defaults.fee_category_id is 'Optional fee category. If null, this is a general class fee.';
comment on column class_fee_defaults.name is 'Name of the fee (e.g., "Tuition Fee", "Development Fee")';

-- ============================================
-- 5. Update optional_fee_definitions comments
-- ============================================
comment on column optional_fee_definitions.name is 'Name of the optional fee';
comment on column optional_fee_definitions.amount is 'Default amount for this optional fee';

-- ============================================
-- 6. Fix student_transport RLS policy to prevent recursion
-- ============================================
-- The recursion happens because the policy references students table
-- which might have policies that reference student_transport
-- Use helper functions and avoid nested queries on students

drop policy if exists mt_student_transport_select on student_transport;
create policy mt_student_transport_select on student_transport
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or exists (
        select 1 from students s 
        where s.id = student_transport.student_id 
        and s.profile_id = auth.uid()
        and s.school_id = get_user_school_id()
      )
      or exists (
        select 1 from student_guardians sg 
        where sg.student_id = student_transport.student_id 
        and sg.guardian_profile_id = auth.uid()
      )
    )
  );

drop policy if exists mt_student_transport_modify on student_transport;
create policy mt_student_transport_modify on student_transport
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

