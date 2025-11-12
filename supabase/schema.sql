-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Helper: get current jwt claim
create or replace function auth_claim(claim text)
returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> claim, null);
$$;

-- Helper: current role and school
create or replace view current_identity as
select
  auth.uid() as user_id,
  auth_claim('role') as role,
  auth_claim('school_id')::uuid as school_id;

-- Tables
create table if not exists schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  contact_email text,
  contact_phone text,
  logo_url text,
  join_code text unique,
  created_at timestamp default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id),
  role text check (role in ('principal', 'clerk', 'teacher', 'student', 'parent')),
  full_name text,
  email text,
  phone text,
  avatar_url text,
  approval_status text check (approval_status in ('approved', 'pending', 'rejected')) default 'pending',
  approved_by uuid references profiles(id),
  approved_at timestamp,
  created_at timestamp default now()
);

create table if not exists class_groups (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id),
  name text not null,
  description text,
  created_at timestamp default now()
);

create table if not exists sections (
  id uuid primary key default uuid_generate_v4(),
  class_group_id uuid references class_groups(id) on delete cascade,
  name text not null
);

create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id),
  name text not null,
  code text,
  created_at timestamp default now()
);

create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id),
  class_group_id uuid references class_groups(id),
  section_id uuid references sections(id),
  roll_number text,
  admission_date date,
  status text check (status in ('active', 'inactive', 'pending')) default 'pending',
  school_id uuid references schools(id)
);

create table if not exists attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id),
  date date not null,
  status text check (status in ('present', 'absent', 'late')),
  class_group_id uuid references class_groups(id),
  marked_by uuid references profiles(id),
  school_id uuid references schools(id),
  created_at timestamp default now()
);

create table if not exists exams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  term text,
  start_date date,
  end_date date,
  school_id uuid references schools(id),
  created_at timestamp default now()
);

create table if not exists marks (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id),
  exam_id uuid references exams(id),
  subject_id uuid references subjects(id),
  marks_obtained numeric,
  max_marks numeric,
  verified_by uuid references profiles(id),
  school_id uuid references schools(id)
);

create table if not exists fee_structures (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id),
  class_group_id uuid references class_groups(id),
  name text not null,
  amount numeric not null,
  due_date date,
  description text
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id),
  fee_structure_id uuid references fee_structures(id),
  amount_paid numeric not null,
  payment_date timestamp default now(),
  payment_mode text check (payment_mode in ('cash', 'online', 'upi', 'card')),
  transaction_id text,
  received_by uuid references profiles(id),
  school_id uuid references schools(id)
);

create table if not exists clerk_logs (
  id uuid primary key default uuid_generate_v4(),
  clerk_id uuid references profiles(id),
  school_id uuid references schools(id),
  action text,
  entity text,
  entity_id uuid,
  timestamp timestamp default now()
);

-- Link parents (guardian profiles) to students for RLS
create table if not exists student_guardians (
  student_id uuid references students(id) on delete cascade,
  guardian_profile_id uuid references profiles(id) on delete cascade,
  relationship text,
  primary key (student_id, guardian_profile_id)
);

-- Classification types: Custom classification categories for classes (e.g., "Grade", "Stream", "House", "Gender")
create table if not exists classification_types (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  name text not null, -- e.g., "Grade", "Stream", "House", "Gender"
  display_order integer default 0,
  created_at timestamp default now(),
  unique(school_id, name)
);

-- Classification values: Specific values for each type (e.g., "Grade 1", "Science", "Red House", "Boys")
create table if not exists classification_values (
  id uuid primary key default uuid_generate_v4(),
  classification_type_id uuid references classification_types(id) on delete cascade,
  value text not null, -- e.g., "Grade 1", "Science", "Red House"
  display_order integer default 0,
  created_at timestamp default now(),
  unique(classification_type_id, value)
);

-- Link classes to classification values (many-to-many)
create table if not exists class_classifications (
  class_group_id uuid references class_groups(id) on delete cascade,
  classification_value_id uuid references classification_values(id) on delete cascade,
  primary key (class_group_id, classification_value_id)
);

-- Row Level Security
alter table profiles enable row level security;
alter table schools enable row level security;
alter table class_groups enable row level security;
alter table sections enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table exams enable row level security;
alter table marks enable row level security;
alter table fee_structures enable row level security;
alter table payments enable row level security;
alter table clerk_logs enable row level security;
alter table student_guardians enable row level security;
alter table classification_types enable row level security;
alter table classification_values enable row level security;
alter table class_classifications enable row level security;

-- Helper: check if user is approved (principals are always approved)
-- This function must be created after the profiles table exists
create or replace function is_approved()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and (approval_status = 'approved' or role = 'principal')
  );
$$;

-- Policies
-- Schools: principals of a school can read their own; creation by service role or platform admin
drop policy if exists schools_read_own on schools;
create policy schools_read_own on schools
  for select using (id = auth_claim('school_id')::uuid);

-- Allow service role to insert schools (needed for signup)
drop policy if exists schools_insert_service_role on schools;
create policy schools_insert_service_role on schools
  for insert with check (true);

-- Allow service role to insert profiles (needed for signup)
drop policy if exists profiles_insert_service_role on profiles;
create policy profiles_insert_service_role on profiles
  for insert with check (true);

-- Profiles: users can read self; principal can read all in their school
drop policy if exists profiles_read_self on profiles;
create policy profiles_read_self on profiles
  for select using (
    id = auth.uid() or (school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal')
  );
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- Generic multi-tenant isolation helper predicate
-- Each table with school_id: only access rows where school_id matches jwt
drop policy if exists mt_select_class_groups on class_groups;
create policy mt_select_class_groups on class_groups
  for select using (school_id = auth_claim('school_id')::uuid);
drop policy if exists mt_modify_class_groups on class_groups;
create policy mt_modify_class_groups on class_groups
  for all using (school_id = auth_claim('school_id')::uuid) with check (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_sections_select on sections;
create policy mt_sections_select on sections
  for select using (class_group_id in (select id from class_groups where school_id = auth_claim('school_id')::uuid));
drop policy if exists mt_sections_modify on sections;
create policy mt_sections_modify on sections
  for all using (class_group_id in (select id from class_groups where school_id = auth_claim('school_id')::uuid))
  with check (class_group_id in (select id from class_groups where school_id = auth_claim('school_id')::uuid));

drop policy if exists mt_subjects_select on subjects;
create policy mt_subjects_select on subjects
  for select using (school_id = auth_claim('school_id')::uuid);
drop policy if exists mt_subjects_modify on subjects;
create policy mt_subjects_modify on subjects
  for all using (school_id = auth_claim('school_id')::uuid) with check (school_id = auth_claim('school_id')::uuid);

-- Students table
-- Staff (principal/clerk/teacher) can access by school
drop policy if exists mt_students_select on students;
create policy mt_students_select_staff on students
  for select using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal','clerk','teacher')
  );
-- Student can access only own student row (via profile_id)
drop policy if exists mt_students_select_self on students;
create policy mt_students_select_self on students
  for select using (
    profile_id = auth.uid() and auth_claim('role') = 'student'
  );
-- Parent can access rows for linked students
drop policy if exists mt_students_select_parent on students;
create policy mt_students_select_parent on students
  for select using (
    auth_claim('role') = 'parent' and exists (
      select 1 from student_guardians sg
      where sg.student_id = students.id and sg.guardian_profile_id = auth.uid()
    )
  );
drop policy if exists mt_students_modify on students;
create policy mt_students_modify on students
  for all using (school_id = auth_claim('school_id')::uuid) with check (school_id = auth_claim('school_id')::uuid);

-- Attendance table
drop policy if exists mt_attendance_select on attendance;
-- Staff by school
create policy mt_attendance_select_staff on attendance
  for select using (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('principal','clerk','teacher')
  );
-- Student: only own attendance
drop policy if exists mt_attendance_select_self on attendance;
create policy mt_attendance_select_self on attendance
  for select using (
    auth_claim('role') = 'student' and student_id in (
      select s.id from students s where s.profile_id = auth.uid()
    )
  );
-- Parent: only linked students' attendance
drop policy if exists mt_attendance_select_parent on attendance;
create policy mt_attendance_select_parent on attendance
  for select using (
    auth_claim('role') = 'parent' and exists (
      select 1 from student_guardians sg where sg.student_id = attendance.student_id and sg.guardian_profile_id = auth.uid()
    )
  );
drop policy if exists mt_attendance_modify on attendance;
create policy mt_attendance_modify on attendance
  for all using (school_id = auth_claim('school_id')::uuid) with check (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_exams_select on exams;
create policy mt_exams_select on exams
  for select using (school_id = auth_claim('school_id')::uuid);
drop policy if exists mt_exams_modify on exams;
create policy mt_exams_modify on exams
  for all using (school_id = auth_claim('school_id')::uuid) with check (school_id = auth_claim('school_id')::uuid);

-- Marks table
drop policy if exists mt_marks_select on marks;
create policy mt_marks_select_staff on marks
  for select using (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('principal','clerk','teacher')
  );
drop policy if exists mt_marks_select_self on marks;
create policy mt_marks_select_self on marks
  for select using (
    auth_claim('role') = 'student' and student_id in (
      select s.id from students s where s.profile_id = auth.uid()
    )
  );
drop policy if exists mt_marks_select_parent on marks;
create policy mt_marks_select_parent on marks
  for select using (
    auth_claim('role') = 'parent' and exists (
      select 1 from student_guardians sg where sg.student_id = marks.student_id and sg.guardian_profile_id = auth.uid()
    )
  );

-- Only teachers and principals can insert raw marks; clerk verifies
drop policy if exists marks_insert_by_staff on marks;
create policy marks_insert_by_staff on marks
  for insert with check (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('teacher','principal')
  );

-- Only clerk or principal can update verified_by
drop policy if exists marks_verify_by_clerk on marks;
create policy marks_verify_by_clerk on marks
  for update using (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('clerk','principal')
  ) with check (
    school_id = auth_claim('school_id')::uuid
  );

drop policy if exists mt_fee_structures_select on fee_structures;
create policy mt_fee_structures_select on fee_structures
  for select using (school_id = auth_claim('school_id')::uuid);

-- Clerk or principal can create/modify fee structures
drop policy if exists fee_structures_modify_by_clerk on fee_structures;
create policy fee_structures_modify_by_clerk on fee_structures
  for all using (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('clerk','principal')
  ) with check (school_id = auth_claim('school_id')::uuid);

-- Payments table
drop policy if exists mt_payments_select on payments;
create policy mt_payments_select_staff on payments
  for select using (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('principal','clerk','teacher')
  );
drop policy if exists mt_payments_select_self on payments;
create policy mt_payments_select_self on payments
  for select using (
    auth_claim('role') = 'student' and student_id in (
      select s.id from students s where s.profile_id = auth.uid()
    )
  );
drop policy if exists mt_payments_select_parent on payments;
create policy mt_payments_select_parent on payments
  for select using (
    auth_claim('role') = 'parent' and exists (
      select 1 from student_guardians sg where sg.student_id = payments.student_id and sg.guardian_profile_id = auth.uid()
    )
  );

-- Optional: let clerk/teacher read profiles within school; students/parents only self; principal all in school
drop policy if exists profiles_read_self on profiles;
create policy profiles_read_self on profiles
  for select using (
    id = auth.uid()
  );
drop policy if exists profiles_read_school_staff on profiles;
create policy profiles_read_school_staff on profiles
  for select using (
    school_id = auth_claim('school_id')::uuid 
    and auth_claim('role') in ('principal','clerk','teacher')
    and is_approved()
  );

-- Guardians table: only staff in school or the guardian themselves can see their links
drop policy if exists sg_select_staff on student_guardians;
create policy sg_select_staff on student_guardians
  for select using (
    auth_claim('role') in ('principal','clerk','teacher') and exists (
      select 1 from students s where s.id = student_guardians.student_id and s.school_id = auth_claim('school_id')::uuid
    )
  );
drop policy if exists sg_select_guardian_self on student_guardians;
create policy sg_select_guardian_self on student_guardians
  for select using (
    guardian_profile_id = auth.uid()
  );

-- Only clerk or principal can insert payments
drop policy if exists payments_insert_by_clerk on payments;
create policy payments_insert_by_clerk on payments
  for insert with check (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('clerk','principal')
  );

drop policy if exists payments_update_by_clerk on payments;
create policy payments_update_by_clerk on payments
  for update using (
    school_id = auth_claim('school_id')::uuid and auth_claim('role') in ('clerk','principal')
  ) with check (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_clerk_logs on clerk_logs;
create policy mt_clerk_logs on clerk_logs
  for all using (school_id = auth_claim('school_id')::uuid) with check (school_id = auth_claim('school_id')::uuid);

-- Classification types policies
drop policy if exists mt_classification_types_select on classification_types;
create policy mt_classification_types_select on classification_types
  for select using (school_id = auth_claim('school_id')::uuid);
drop policy if exists mt_classification_types_modify on classification_types;
create policy mt_classification_types_modify on classification_types
  for all using (school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal')
  with check (school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal');

-- Classification values policies (accessible through type's school_id)
drop policy if exists mt_classification_values_select on classification_values;
create policy mt_classification_values_select on classification_values
  for select using (
    classification_type_id in (
      select id from classification_types where school_id = auth_claim('school_id')::uuid
    )
  );
drop policy if exists mt_classification_values_modify on classification_values;
create policy mt_classification_values_modify on classification_values
  for all using (
    classification_type_id in (
      select id from classification_types 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  ) with check (
    classification_type_id in (
      select id from classification_types 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  );

-- Class classifications policies
drop policy if exists mt_class_classifications_select on class_classifications;
create policy mt_class_classifications_select on class_classifications
  for select using (
    class_group_id in (
      select id from class_groups where school_id = auth_claim('school_id')::uuid
    )
  );
drop policy if exists mt_class_classifications_modify on class_classifications;
create policy mt_class_classifications_modify on class_classifications
  for all using (
    class_group_id in (
      select id from class_groups 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  ) with check (
    class_group_id in (
      select id from class_groups 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  );

-- Refresh schema cache so Supabase recognizes the new tables
-- Run this after creating all tables and policies
NOTIFY pgrst, 'reload schema';

