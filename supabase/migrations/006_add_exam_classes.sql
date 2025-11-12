-- Migration: Add exam_classes table to link exams to specific classes
-- This allows exams to be assigned to particular classes or all classes

-- Link exams to classes (many-to-many)
-- If an exam has no entries in this table, it applies to all classes
create table if not exists exam_classes (
  exam_id uuid references exams(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  primary key (exam_id, class_group_id)
);

-- Enable Row Level Security
alter table exam_classes enable row level security;

-- Exam classes policies
drop policy if exists mt_exam_classes_select on exam_classes;
create policy mt_exam_classes_select on exam_classes
  for select using (
    exam_id in (
      select id from exams where school_id = auth_claim('school_id')::uuid
    )
  );

drop policy if exists mt_exam_classes_modify on exam_classes;
create policy mt_exam_classes_modify on exam_classes
  for all using (
    exam_id in (
      select id from exams 
      where school_id = auth_claim('school_id')::uuid 
      and auth_claim('role') = 'principal'
    )
  ) with check (
    exam_id in (
      select id from exams 
      where school_id = auth_claim('school_id')::uuid 
      and auth_claim('role') = 'principal'
    )
  );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE exam_classes IS 'Links exams to specific classes. If an exam has no entries here, it applies to all classes.';

