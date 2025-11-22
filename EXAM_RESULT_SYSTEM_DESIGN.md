# Exam & Result Management System Design

## Overview
A comprehensive exam and result management system with:
- Exam-subject mapping
- Teacher permissions (only assigned classes/subjects)
- Clerk permissions (view all results, read-only)
- Proper constraints and indexes

## Database Schema

### 1. Exams Table (Already exists, verify structure)
```sql
create table if not exists exams (
  id uuid primary key default uuid_generate_v4(),
  name text not null, -- exam_name
  term text, -- term/period
  start_date date,
  end_date date,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now()
);
```

### 2. Exam Subjects (Mapping Table - NEW)
Links exams to subjects. One exam can have many subjects.

```sql
create table if not exists exam_subjects (
  exam_id uuid references exams(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now(),
  primary key (exam_id, subject_id)
);
```

### 3. Marks Table (Enhanced)
Add UNIQUE constraint and indexes.

```sql
-- Add unique constraint if not exists
alter table marks 
  add constraint unique_student_exam_subject 
  unique(student_id, exam_id, subject_id);

-- Add indexes for performance
create index if not exists idx_marks_student on marks(student_id);
create index if not exists idx_marks_exam on marks(exam_id);
create index if not exists idx_marks_subject on marks(subject_id);
create index if not exists idx_marks_school on marks(school_id);
create index if not exists idx_marks_verified on marks(verified_by) where verified_by is not null;
```

### 4. Students Table (Already exists)
```sql
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

-- Index for fast filtering
create index if not exists idx_students_class on students(class_group_id);
create index if not exists idx_students_section on students(section_id);
create index if not exists idx_students_school on students(school_id);
```

### 5. Teacher Assignments (Already exists)
```sql
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
```

## System Logic

### 1. Teacher Permissions

**Enter Marks:**
- Teacher can only enter marks for subjects they are assigned to
- Teacher can only enter marks for classes they are assigned to
- Verification: Check `teacher_assignments` table

**View Marks:**
- Teacher can only view marks for their assigned classes/subjects
- Cannot see marks for other classes

### 2. Clerk Permissions

**View All Results:**
- Clerk can view ALL exam results for ALL students in their school
- Can filter by:
  - Class (`class_group_id`)
  - Section (`section_id`)
  - Exam (`exam_id`)
  - Student (`student_id`)
  - Subject (`subject_id`)
- Read-only access (cannot edit/delete)
- Cannot see data from other schools

### 3. Principal Permissions

- Can view all results
- Can enter/edit marks
- Can verify marks
- Full access to all exams and results

## API Endpoints

### For Teachers

1. **Get Exams for Teacher**
   ```
   GET /marks/exams/teacher
   ```
   Returns only exams where teacher has assignments

2. **Get Students for Marks Entry**
   ```
   GET /marks/students?exam_id=xxx&subject_id=xxx&class_group_id=xxx&section_id=xxx
   ```
   Returns students from teacher's assigned classes

3. **Enter Marks (Bulk)**
   ```
   POST /marks/bulk
   ```
   Validates teacher assignments before saving

4. **View Marks (Teacher's Classes Only)**
   ```
   GET /marks/teacher?exam_id=xxx&class_group_id=xxx&subject_id=xxx
   ```
   Returns marks only for teacher's assigned classes/subjects

### For Clerks

1. **View All Results (with filters)**
   ```
   GET /marks/results?class_group_id=xxx&section_id=xxx&exam_id=xxx&student_id=xxx&subject_id=xxx
   ```
   Returns all marks for the school with filtering

2. **Get Student Marksheet**
   ```
   GET /marks/student/:studentId
   ```
   Full marksheet for a student

3. **Get Exam Results**
   ```
   GET /marks/exam/:examId?class_group_id=xxx&section_id=xxx
   ```
   All results for an exam (with optional class/section filter)

4. **Get Class Results**
   ```
   GET /marks/class/:classGroupId?exam_id=xxx&section_id=xxx
   ```
   All results for a class (with optional exam/section filter)

## RLS Policies

### Marks Table

**Select Policy:**
- Teachers: Only marks for their assigned classes/subjects
- Clerks: All marks in their school
- Principals: All marks in their school
- Students: Only their own marks
- Parents: Only their children's marks

**Modify Policy:**
- Teachers: Can insert/update marks for their assigned classes/subjects (before verification)
- Clerks: Read-only (cannot modify)
- Principals: Full access

### Exam Subjects Table

**Select Policy:**
- All authenticated users in the school

**Modify Policy:**
- Principals only

## Query Examples

### Get All Results for Clerk (with filters)
```sql
SELECT 
  m.*,
  s.roll_number,
  s.class_group_id,
  s.section_id,
  p.full_name as student_name,
  e.name as exam_name,
  e.term,
  sub.name as subject_name,
  sub.code as subject_code,
  cg.name as class_name,
  sec.name as section_name
FROM marks m
JOIN students s ON s.id = m.student_id
JOIN profiles p ON p.id = s.profile_id
JOIN exams e ON e.id = m.exam_id
JOIN subjects sub ON sub.id = m.subject_id
LEFT JOIN class_groups cg ON cg.id = s.class_group_id
LEFT JOIN sections sec ON sec.id = s.section_id
WHERE m.school_id = $1
  AND ($2::uuid IS NULL OR s.class_group_id = $2)
  AND ($3::uuid IS NULL OR s.section_id = $3)
  AND ($4::uuid IS NULL OR m.exam_id = $4)
  AND ($5::uuid IS NULL OR m.student_id = $5)
  AND ($6::uuid IS NULL OR m.subject_id = $6)
ORDER BY e.start_date DESC, s.roll_number, sub.name;
```

### Get Teacher's Assigned Classes/Subjects
```sql
SELECT DISTINCT
  ta.class_group_id,
  ta.subject_id,
  ta.section_id,
  cg.name as class_name,
  sub.name as subject_name,
  sec.name as section_name
FROM teacher_assignments ta
JOIN class_groups cg ON cg.id = ta.class_group_id
JOIN subjects sub ON sub.id = ta.subject_id
LEFT JOIN sections sec ON sec.id = ta.section_id
WHERE ta.teacher_id = $1
  AND ta.school_id = $2;
```

