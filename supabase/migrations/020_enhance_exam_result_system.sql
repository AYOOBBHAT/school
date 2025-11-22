-- Migration: Enhance exam & result management system
-- Adds exam_subjects mapping, constraints, indexes, and clerk permissions

-- ============================================
-- 1. EXAM SUBJECTS (Mapping table)
-- ============================================
create table if not exists exam_subjects (
  exam_id uuid references exams(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now(),
  primary key (exam_id, subject_id)
);

-- Index for fast lookups
create index idx_exam_subjects_exam on exam_subjects(exam_id);
create index idx_exam_subjects_subject on exam_subjects(subject_id);
create index idx_exam_subjects_school on exam_subjects(school_id);

-- ============================================
-- 2. ENHANCE MARKS TABLE
-- ============================================

-- Add unique constraint if not exists (prevent duplicate marks)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'unique_student_exam_subject'
  ) then
    alter table marks 
      add constraint unique_student_exam_subject 
      unique(student_id, exam_id, subject_id);
  end if;
end $$;

-- Add indexes for performance
create index if not exists idx_marks_student on marks(student_id);
create index if not exists idx_marks_exam on marks(exam_id);
create index if not exists idx_marks_subject on marks(subject_id);
create index if not exists idx_marks_school on marks(school_id);
create index if not exists idx_marks_verified on marks(verified_by) where verified_by is not null;
create index if not exists idx_marks_student_exam on marks(student_id, exam_id);

-- ============================================
-- 3. ENHANCE STUDENTS TABLE INDEXES
-- ============================================
create index if not exists idx_students_class on students(class_group_id);
create index if not exists idx_students_section on students(section_id);
create index if not exists idx_students_school on students(school_id);
create index if not exists idx_students_class_section on students(class_group_id, section_id);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
alter table exam_subjects enable row level security;

-- ============================================
-- RLS Policies - Exam Subjects
-- ============================================
drop policy if exists mt_exam_subjects_select on exam_subjects;
create policy mt_exam_subjects_select on exam_subjects
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s 
        where s.profile_id = auth.uid()
        and s.school_id = exam_subjects.school_id
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
        and s.school_id = exam_subjects.school_id
      ))
    )
  );

drop policy if exists mt_exam_subjects_modify on exam_subjects;
create policy mt_exam_subjects_modify on exam_subjects
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'principal'
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') = 'principal'
  );

-- ============================================
-- RLS Policies - Marks (Enhanced for Clerk)
-- ============================================

-- Drop existing policies
drop policy if exists mt_marks_select on marks;
drop policy if exists mt_marks_modify on marks;

-- Select Policy: Teachers see only assigned, Clerks see all, Students see own
create policy mt_marks_select on marks
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      -- Principals: All marks
      auth_claim('role') = 'principal'
      -- Clerks: All marks (read-only)
      or auth_claim('role') = 'clerk'
      -- Teachers: Only assigned classes/subjects
      or (auth_claim('role') = 'teacher' and exists (
        select 1 from teacher_assignments ta
        join students s on s.id = marks.student_id
        where ta.teacher_id = auth.uid()
        and ta.class_group_id = s.class_group_id
        and ta.subject_id = marks.subject_id
        and (ta.section_id is null or ta.section_id = s.section_id)
      ))
      -- Students: Only own marks
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      -- Parents: Only children's marks
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = marks.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

-- Modify Policy: Teachers can insert/update (before verification), Principals full access, Clerks read-only
create policy mt_marks_modify on marks
  for all using (
    school_id = auth_claim('school_id')::uuid
    and (
      -- Principals: Full access
      auth_claim('role') = 'principal'
      -- Teachers: Only assigned classes/subjects, and only if not verified
      or (auth_claim('role') = 'teacher' 
          and verified_by is null
          and exists (
            select 1 from teacher_assignments ta
            join students s on s.id = marks.student_id
            where ta.teacher_id = auth.uid()
            and ta.class_group_id = s.class_group_id
            and ta.subject_id = marks.subject_id
            and (ta.section_id is null or ta.section_id = s.section_id)
          ))
    )
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') = 'principal'
      or (auth_claim('role') = 'teacher' 
          and verified_by is null
          and exists (
            select 1 from teacher_assignments ta
            join students s on s.id = marks.student_id
            where ta.teacher_id = auth.uid()
            and ta.class_group_id = s.class_group_id
            and ta.subject_id = marks.subject_id
            and (ta.section_id is null or ta.section_id = s.section_id)
          ))
    )
  );

-- ============================================
-- Function: Get teacher's assigned classes/subjects
-- ============================================
create or replace function get_teacher_assignments(teacher_uuid uuid, school_uuid uuid)
returns table (
  class_group_id uuid,
  subject_id uuid,
  section_id uuid,
  class_name text,
  subject_name text,
  section_name text
) language sql stable as $$
  select distinct
    ta.class_group_id,
    ta.subject_id,
    ta.section_id,
    cg.name as class_name,
    sub.name as subject_name,
    sec.name as section_name
  from teacher_assignments ta
  join class_groups cg on cg.id = ta.class_group_id
  join subjects sub on sub.id = ta.subject_id
  left join sections sec on sec.id = ta.section_id
  where ta.teacher_id = teacher_uuid
    and ta.school_id = school_uuid;
$$;

-- ============================================
-- Comments
-- ============================================
comment on table exam_subjects is 'Maps exams to subjects - one exam can have many subjects';
comment on constraint unique_student_exam_subject on marks is 'Ensures one marks record per student per exam per subject';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

