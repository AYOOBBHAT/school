-- Migration: Enhance Student Management
-- Adds: Date of Birth, Home Address to students
-- Ensures parent/guardian information is properly stored

-- ============================================
-- 1. Add missing fields to students table
-- ============================================
alter table students
  add column if not exists date_of_birth date,
  add column if not exists home_address text;

-- Add index for date of birth queries
create index if not exists idx_students_dob on students(date_of_birth);

-- ============================================
-- 2. Enhance student_guardians table
-- Add fields for guardian name and phone (stored in profiles, but we need quick access)
-- Note: Guardian name and phone are in profiles table, but we ensure relationship is mandatory
-- ============================================
-- Add relationship type if not exists
alter table student_guardians
  add column if not exists relationship text default 'parent';

-- Add index for guardian lookups
create index if not exists idx_student_guardians_student on student_guardians(student_id);
create index if not exists idx_student_guardians_guardian on student_guardians(guardian_profile_id);

-- ============================================
-- 3. Teacher Attendance Assignment Table
-- Separate from teaching assignments - specifically for attendance marking
-- ============================================
create table if not exists teacher_attendance_assignments (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(teacher_id, class_group_id, section_id)
);

-- Indexes for attendance assignments
create index if not exists idx_teacher_attendance_assignments_teacher on teacher_attendance_assignments(teacher_id, is_active);
create index if not exists idx_teacher_attendance_assignments_class on teacher_attendance_assignments(class_group_id, section_id, is_active);

-- ============================================
-- 4. Update Attendance Structure
-- Ensure attendance is stored per class per day (not subject-wise)
-- The existing structure already supports this, but we'll add a comment
-- ============================================
comment on table student_attendance is 'Student attendance records - one record per student per day per class (NOT subject-wise)';
comment on column student_attendance.class_group_id is 'Class for which attendance is marked - attendance is class-level, not subject-level';

-- ============================================
-- Enable Row Level Security
-- ============================================
alter table teacher_attendance_assignments enable row level security;

-- ============================================
-- RLS Policies - Teacher Attendance Assignments
-- ============================================
drop policy if exists mt_teacher_attendance_assignments_select on teacher_attendance_assignments;
create policy mt_teacher_attendance_assignments_select on teacher_attendance_assignments
  for select using (school_id = get_user_school_id());

drop policy if exists mt_teacher_attendance_assignments_modify on teacher_attendance_assignments;
create policy mt_teacher_attendance_assignments_modify on teacher_attendance_assignments
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- Triggers
-- ============================================
drop trigger if exists update_teacher_attendance_assignments_updated_at on teacher_attendance_assignments;
create trigger update_teacher_attendance_assignments_updated_at
  before update on teacher_attendance_assignments
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Comments
-- ============================================
comment on column students.date_of_birth is 'Student date of birth';
comment on column students.home_address is 'Student home address';
comment on table teacher_attendance_assignments is 'Assigns teachers to classes specifically for attendance marking (separate from teaching assignments)';

