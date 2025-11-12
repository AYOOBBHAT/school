-- Migration: Add class_subjects junction table
-- This migration creates a table to link classes to subjects (many-to-many relationship)
-- This allows principals to define which subjects are taught in which classes

-- Class subjects: Maps classes to subjects
create table if not exists class_subjects (
  id uuid primary key default uuid_generate_v4(),
  class_group_id uuid references class_groups(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now(),
  unique(class_group_id, subject_id)
);

-- Enable RLS
alter table class_subjects enable row level security;

-- Class subjects policies
drop policy if exists mt_class_subjects_select on class_subjects;
create policy mt_class_subjects_select on class_subjects
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_class_subjects_modify on class_subjects;
create policy mt_class_subjects_modify on class_subjects
  for all using (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

