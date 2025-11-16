-- Migration: Add exam_schedule table to store date sheet entries
-- Each entry represents a subject exam with date and time

create table if not exists exam_schedule (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid references exams(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  exam_date date not null,
  time_from time not null,
  time_to time not null,
  school_id uuid references schools(id),
  created_at timestamp default now()
);

-- Enable Row Level Security
alter table exam_schedule enable row level security;

-- Exam schedule policies
drop policy if exists mt_exam_schedule_select on exam_schedule;
create policy mt_exam_schedule_select on exam_schedule
  for select using (
    exam_id in (
      select id from exams where school_id = auth_claim('school_id')::uuid
    )
  );

drop policy if exists mt_exam_schedule_modify on exam_schedule;
create policy mt_exam_schedule_modify on exam_schedule
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

COMMENT ON TABLE exam_schedule IS 'Stores the date sheet for each exam with subject, date, and time slots';

