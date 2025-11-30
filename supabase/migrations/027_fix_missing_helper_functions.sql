-- Migration: Fix Missing Helper Functions and RLS Policies
-- This migration ensures all required helper functions exist and RLS policies are properly configured
-- Fixes "Error Loading Staff", "Error Loading Classes", etc. on Principal Dashboard

-- ============================================
-- Helper Functions (Required for RLS)
-- ============================================

-- Function to get user's school_id from profiles table
create or replace function get_user_school_id()
returns uuid as $$
  select school_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Function to get user's role from profiles table
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================
-- Enable RLS on all tables (if not already enabled)
-- ============================================
alter table profiles enable row level security;
alter table class_groups enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table sections enable row level security;
alter table classification_types enable row level security;
alter table classification_values enable row level security;
alter table class_classifications enable row level security;
alter table class_subjects enable row level security;
alter table teacher_assignments enable row level security;

-- ============================================
-- RLS Policies - Profiles (Staff)
-- ============================================
drop policy if exists mt_profiles_select on profiles;
create policy mt_profiles_select on profiles
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk')
      or id = auth.uid() -- Users can always see their own profile
    )
  );

drop policy if exists mt_profiles_modify on profiles;
create policy mt_profiles_modify on profiles
  for all using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Class Groups
-- ============================================
drop policy if exists mt_class_groups_select on class_groups;
create policy mt_class_groups_select on class_groups
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and exists (
        select 1 from students s 
        where s.profile_id = auth.uid()
        and s.class_group_id = class_groups.id
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
        and s.class_group_id = class_groups.id
      ))
    )
  );

drop policy if exists mt_class_groups_modify on class_groups;
create policy mt_class_groups_modify on class_groups
  for all using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Subjects
-- ============================================
drop policy if exists mt_subjects_select on subjects;
create policy mt_subjects_select on subjects
  for select using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk', 'teacher', 'student', 'parent')
  );

drop policy if exists mt_subjects_modify on subjects;
create policy mt_subjects_modify on subjects
  for all using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Students
-- ============================================
drop policy if exists mt_students_select on students;
create policy mt_students_select on students
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and profile_id = auth.uid())
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg 
        where sg.student_id = students.id 
        and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_students_modify on students;
create policy mt_students_modify on students
  for all using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Sections
-- ============================================
drop policy if exists mt_sections_select on sections;
create policy mt_sections_select on sections
  for select using (
    exists (
      select 1 from class_groups cg
      where cg.id = sections.class_group_id
      and cg.school_id = get_user_school_id()
      and (
        get_user_role() in ('principal', 'clerk', 'teacher')
        or (get_user_role() = 'student' and exists (
          select 1 from students s 
          where s.profile_id = auth.uid()
          and s.class_group_id = cg.id
        ))
        or (get_user_role() = 'parent' and exists (
          select 1 from student_guardians sg
          join students s on s.id = sg.student_id
          where sg.guardian_profile_id = auth.uid()
          and s.class_group_id = cg.id
        ))
      )
    )
  );

drop policy if exists mt_sections_modify on sections;
create policy mt_sections_modify on sections
  for all using (
    exists (
      select 1 from class_groups cg
      where cg.id = sections.class_group_id
      and cg.school_id = get_user_school_id()
      and get_user_role() in ('principal', 'clerk')
    )
  ) with check (
    exists (
      select 1 from class_groups cg
      where cg.id = sections.class_group_id
      and cg.school_id = get_user_school_id()
      and get_user_role() in ('principal', 'clerk')
    )
  );

-- ============================================
-- RLS Policies - Classification Types
-- ============================================
drop policy if exists mt_classification_types_select on classification_types;
create policy mt_classification_types_select on classification_types
  for select using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk', 'teacher')
  );

drop policy if exists mt_classification_types_modify on classification_types;
create policy mt_classification_types_modify on classification_types
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Classification Values
-- ============================================
drop policy if exists mt_classification_values_select on classification_values;
create policy mt_classification_values_select on classification_values
  for select using (
    exists (
      select 1 from classification_types ct
      where ct.id = classification_values.classification_type_id
      and ct.school_id = get_user_school_id()
      and get_user_role() in ('principal', 'clerk', 'teacher')
    )
  );

drop policy if exists mt_classification_values_modify on classification_values;
create policy mt_classification_values_modify on classification_values
  for all using (
    exists (
      select 1 from classification_types ct
      where ct.id = classification_values.classification_type_id
      and ct.school_id = get_user_school_id()
      and get_user_role() = 'principal'
    )
  ) with check (
    exists (
      select 1 from classification_types ct
      where ct.id = classification_values.classification_type_id
      and ct.school_id = get_user_school_id()
      and get_user_role() = 'principal'
    )
  );

-- ============================================
-- RLS Policies - Class Classifications
-- ============================================
drop policy if exists mt_class_classifications_select on class_classifications;
create policy mt_class_classifications_select on class_classifications
  for select using (
    exists (
      select 1 from class_groups cg
      where cg.id = class_classifications.class_group_id
      and cg.school_id = get_user_school_id()
      and get_user_role() in ('principal', 'clerk', 'teacher')
    )
  );

drop policy if exists mt_class_classifications_modify on class_classifications;
create policy mt_class_classifications_modify on class_classifications
  for all using (
    exists (
      select 1 from class_groups cg
      where cg.id = class_classifications.class_group_id
      and cg.school_id = get_user_school_id()
      and get_user_role() in ('principal', 'clerk')
    )
  ) with check (
    exists (
      select 1 from class_groups cg
      where cg.id = class_classifications.class_group_id
      and cg.school_id = get_user_school_id()
      and get_user_role() in ('principal', 'clerk')
    )
  );

-- ============================================
-- RLS Policies - Class Subjects
-- ============================================
drop policy if exists mt_class_subjects_select on class_subjects;
create policy mt_class_subjects_select on class_subjects
  for select using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk', 'teacher', 'student', 'parent')
  );

drop policy if exists mt_class_subjects_modify on class_subjects;
create policy mt_class_subjects_modify on class_subjects
  for all using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Teacher Assignments
-- ============================================
drop policy if exists mt_teacher_assignments_select on teacher_assignments;
create policy mt_teacher_assignments_select on teacher_assignments
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'teacher' and teacher_id = auth.uid())
    )
  );

drop policy if exists mt_teacher_assignments_modify on teacher_assignments;
create policy mt_teacher_assignments_modify on teacher_assignments
  for all using (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() in ('principal', 'clerk')
  );

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

