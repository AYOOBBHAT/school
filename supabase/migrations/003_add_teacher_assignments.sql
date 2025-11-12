-- Migration: Add teacher assignments and attendance tables
-- This migration creates tables for teacher-class-subject assignments and teacher attendance tracking

-- Teacher assignments: Maps teachers to classes and subjects
create table if not exists teacher_assignments (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now(),
  unique(teacher_id, class_group_id, subject_id, section_id)
);

-- Teacher attendance: Track teacher presence
create table if not exists teacher_attendance (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references profiles(id) on delete cascade,
  date date not null,
  status text check (status in ('present', 'absent', 'late', 'leave')) default 'present',
  school_id uuid references schools(id) on delete cascade,
  marked_by uuid references profiles(id),
  notes text,
  created_at timestamp default now(),
  unique(teacher_id, date)
);

-- Enable RLS
alter table teacher_assignments enable row level security;
alter table teacher_attendance enable row level security;

-- Teacher assignments policies
drop policy if exists mt_teacher_assignments_select on teacher_assignments;
create policy mt_teacher_assignments_select on teacher_assignments
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_teacher_assignments_modify on teacher_assignments;
create policy mt_teacher_assignments_modify on teacher_assignments
  for all using (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Teacher attendance policies
drop policy if exists mt_teacher_attendance_select on teacher_attendance;
create policy mt_teacher_attendance_select on teacher_attendance
  for select using (
    school_id = auth_claim('school_id')::uuid 
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or teacher_id = auth.uid()
    )
  );

drop policy if exists mt_teacher_attendance_modify on teacher_attendance;
create policy mt_teacher_attendance_modify on teacher_attendance
  for all using (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Refresh schema cache (PostgREST needs to reload to see new tables)
NOTIFY pgrst, 'reload schema';

-- Ensure the table is properly created and accessible
-- If you still see schema cache errors, restart PostgREST or run:
-- SELECT pg_notify('pgrst', 'reload schema');

