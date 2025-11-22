-- Migration: Add comprehensive attendance management system
-- Supports: Timetable, holiday handling, one-class-per-day per teacher, locking

-- ============================================
-- 1. TIMETABLE (Period Schedule)
-- ============================================
create table if not exists timetable (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete cascade,
  
  -- Period details
  day_of_week integer check (day_of_week between 0 and 6), -- 0=Sunday, 1=Monday, etc.
  period_number integer not null check (period_number > 0),
  start_time time not null,
  end_time time not null,
  
  -- Academic year
  academic_year integer not null,
  term text, -- 'first-term', 'second-term', 'full-year'
  
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  unique(school_id, class_group_id, section_id, day_of_week, period_number, academic_year)
);

-- Indexes for timetable
create index idx_timetable_teacher_day on timetable(teacher_id, day_of_week, academic_year, is_active);
create index idx_timetable_class_day on timetable(class_group_id, section_id, day_of_week, academic_year);

-- ============================================
-- 2. SCHOOL HOLIDAYS
-- ============================================
create table if not exists school_holidays (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  holiday_date date not null,
  holiday_name text not null,
  description text,
  is_recurring boolean default false, -- For annual holidays
  created_at timestamp default now(),
  unique(school_id, holiday_date)
);

-- Index for holiday lookups
create index idx_school_holidays_date on school_holidays(school_id, holiday_date);

-- ============================================
-- 3. STUDENT ATTENDANCE (Enhanced)
-- ============================================
-- Drop existing attendance table if it exists and recreate with new structure
drop table if exists student_attendance cascade;

create table student_attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  attendance_date date not null,
  status text check (status in ('present', 'absent', 'late', 'leave', 'holiday')) not null,
  
  -- Locking
  marked_by uuid references profiles(id),
  marked_at timestamp default now(),
  is_locked boolean default false, -- Locked after submission
  
  remarks text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Prevent duplicate attendance for same student on same date
  unique(student_id, attendance_date)
);

-- Indexes for attendance
create index idx_student_attendance_date on student_attendance(attendance_date, class_group_id);
create index idx_student_attendance_student on student_attendance(student_id, attendance_date);
create index idx_student_attendance_class_date on student_attendance(class_group_id, section_id, attendance_date);

-- Index for class-level locking check
create unique index idx_class_attendance_lock 
  on student_attendance(class_group_id, attendance_date, marked_by) 
  where is_locked = true;

-- ============================================
-- 4. CLASS ATTENDANCE LOCK
-- ============================================
create table if not exists class_attendance_lock (
  id uuid primary key default uuid_generate_v4(),
  class_group_id uuid references class_groups(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete cascade,
  
  attendance_date date not null,
  locked_at timestamp default now(),
  
  -- One teacher can lock one class per day
  unique(teacher_id, attendance_date),
  -- One class can be locked once per day
  unique(class_group_id, section_id, attendance_date)
);

-- Indexes for lock lookups
create index idx_class_lock_teacher_date on class_attendance_lock(teacher_id, attendance_date);
create index idx_class_lock_class_date on class_attendance_lock(class_group_id, section_id, attendance_date);

-- ============================================
-- Enable Row Level Security
-- ============================================
alter table timetable enable row level security;
alter table school_holidays enable row level security;
alter table student_attendance enable row level security;
alter table class_attendance_lock enable row level security;

-- ============================================
-- RLS Policies - Timetable
-- ============================================
drop policy if exists mt_timetable_select on timetable;
create policy mt_timetable_select on timetable
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s 
        where s.profile_id = auth.uid()
        and s.class_group_id = timetable.class_group_id
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
        and s.class_group_id = timetable.class_group_id
      ))
    )
  );

drop policy if exists mt_timetable_modify on timetable;
create policy mt_timetable_modify on timetable
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - School Holidays
-- ============================================
drop policy if exists mt_school_holidays_select on school_holidays;
create policy mt_school_holidays_select on school_holidays
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_school_holidays_modify on school_holidays;
create policy mt_school_holidays_modify on school_holidays
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Attendance
-- ============================================
drop policy if exists mt_student_attendance_select on student_attendance;
create policy mt_student_attendance_select on student_attendance
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_attendance.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_attendance_modify on student_attendance;
create policy mt_student_attendance_modify on student_attendance
  for all using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and marked_by = auth.uid() and is_locked = false)
    )
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and marked_by = auth.uid())
    )
  );

-- ============================================
-- RLS Policies - Class Attendance Lock
-- ============================================
drop policy if exists mt_class_attendance_lock_select on class_attendance_lock;
create policy mt_class_attendance_lock_select on class_attendance_lock
  for select using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk', 'teacher')
  );

drop policy if exists mt_class_attendance_lock_modify on class_attendance_lock;
create policy mt_class_attendance_lock_modify on class_attendance_lock
  for all using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'teacher' and teacher_id = auth.uid())
    )
  );

-- ============================================
-- Triggers
-- ============================================
create trigger update_timetable_updated_at
  before update on timetable
  for each row
  execute function update_updated_at_column();

create trigger update_student_attendance_updated_at
  before update on student_attendance
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Function: Auto-mark holiday attendance
-- ============================================
create or replace function auto_mark_holiday_attendance()
returns trigger language plpgsql as $$
begin
  -- If holiday status is being set, mark all active students for that date
  if new.status = 'holiday' then
    -- This will be handled by application logic
    -- Function here for potential future use
  end if;
  return new;
end;
$$;

-- ============================================
-- Comments
-- ============================================
comment on table timetable is 'Period schedule for classes - determines teacher first class for attendance';
comment on table school_holidays is 'Declared school holidays - prevents attendance marking';
comment on table student_attendance is 'Student attendance records with locking mechanism';
comment on table class_attendance_lock is 'Tracks which teacher marked which class on which day - prevents multi-class marking';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

