# Exam & Result Management System - Usage Guide

## Overview
A comprehensive exam and result management system with proper permissions for teachers and clerks.

## Database Schema

### Tables

1. **`exams`**: Exam master table
   - `id`, `name`, `term`, `start_date`, `end_date`, `school_id`

2. **`exam_subjects`**: Maps exams to subjects (NEW)
   - `exam_id`, `subject_id`, `school_id`
   - Primary key: `(exam_id, subject_id)`

3. **`marks`**: Student marks
   - `id`, `student_id`, `exam_id`, `subject_id`, `marks_obtained`, `max_marks`, `verified_by`, `school_id`
   - **Constraint**: `UNIQUE(student_id, exam_id, subject_id)`

4. **`teacher_assignments`**: Teacher-class-subject assignments
   - Used to determine teacher permissions

## API Endpoints

### Exam Management

#### 1. Create Exam
```
POST /exams
Body: {
  name: "Mid-Term Exam",
  term: "First Term",
  schedule: [...],
  class_group_ids: [...]
}
```

#### 2. Add Subjects to Exam
```
POST /exams/:examId/subjects
Body: {
  subject_ids: ["uuid1", "uuid2", "uuid3"]
}
```

#### 3. Get Subjects for Exam
```
GET /exams/:examId/subjects
Response: {
  subjects: [
    { subject_id: "uuid", subjects: { id, name, code } }
  ]
}
```

### Marks Entry (Teachers)

#### 1. Get Teacher's Assignments
```
GET /marks/teacher/assignments
Response: {
  assignments: [
    {
      class_group_id: "uuid",
      subject_id: "uuid",
      section_id: "uuid",
      class_groups: { name: "Class 10" },
      subjects: { name: "Mathematics" },
      sections: { name: "A" }
    }
  ]
}
```

#### 2. Get Students for Marks Entry
```
GET /marks/students?exam_id=xxx&subject_id=xxx&class_group_id=xxx&section_id=xxx
```
Returns students from teacher's assigned classes only.

#### 3. Enter Marks (Bulk)
```
POST /marks/bulk
Body: {
  marks: [
    {
      student_id: "uuid",
      exam_id: "uuid",
      subject_id: "uuid",
      marks_obtained: 85,
      max_marks: 100,
      school_id: "uuid"
    }
  ]
}
```
- Validates teacher assignments
- Prevents duplicate marks (upserts)

#### 4. View Marks (Teacher's Classes Only)
```
GET /marks/teacher?exam_id=xxx&class_group_id=xxx&subject_id=xxx
```
Returns marks only for teacher's assigned classes/subjects.

### Results Viewing (Clerks)

#### 1. View All Results (with filters)
```
GET /marks/results?class_group_id=xxx&section_id=xxx&exam_id=xxx&student_id=xxx&subject_id=xxx
Response: {
  results: [
    {
      id: "uuid",
      student_id: "uuid",
      exam_id: "uuid",
      subject_id: "uuid",
      marks_obtained: 85,
      max_marks: 100,
      verified_by: "uuid",
      students: {
        roll_number: "001",
        profile: { full_name: "John Doe" },
        class_groups: { name: "Class 10" },
        sections: { name: "A" }
      },
      exams: { name: "Mid-Term", term: "First Term" },
      subjects: { name: "Mathematics", code: "MATH" }
    }
  ],
  count: 150
}
```

#### 2. Get Exam Results
```
GET /marks/exam/:examId?class_group_id=xxx&section_id=xxx
Response: {
  exam_id: "uuid",
  results: [
    {
      student: { ... },
      subjects: [
        { subject: {...}, marks_obtained: 85, max_marks: 100, percentage: "85.00", verified: true }
      ]
    }
  ],
  raw: [...]
}
```

#### 3. Get Class Results
```
GET /marks/class/:classGroupId?section_id=xxx&exam_id=xxx
Response: {
  class_group_id: "uuid",
  results: [...],
  count: 50
}
```

#### 4. Get Student Marksheet
```
GET /marks/marksheet/:studentId
Response: {
  marksheet: [
    {
      exam_id: "uuid",
      subject_id: "uuid",
      marks_obtained: 85,
      max_marks: 100,
      exams: { name: "Mid-Term", term: "First Term" },
      subjects: { name: "Mathematics", code: "MATH" }
    }
  ]
}
```

#### 5. Get Pending Marks (for verification)
```
GET /marks/pending
Response: {
  marks: [
    {
      id: "uuid",
      student_id: "uuid",
      exam_id: "uuid",
      subject_id: "uuid",
      marks_obtained: 85,
      max_marks: 100,
      exams: {...},
      subjects: {...},
      students: {...}
    }
  ]
}
```

#### 6. Verify Marks
```
POST /marks/verify
Body: {
  marks_id: "uuid"
}
```

## Permission Matrix

| Action | Teacher | Clerk | Principal |
|--------|---------|-------|-----------|
| Create Exam | ❌ | ❌ | ✅ |
| Add Subjects to Exam | ❌ | ❌ | ✅ |
| Enter Marks | ✅ (assigned only) | ❌ | ✅ (all) |
| View Own Marks | ✅ (assigned only) | ✅ (all) | ✅ (all) |
| View All Results | ❌ | ✅ (read-only) | ✅ (full) |
| Verify Marks | ❌ | ✅ | ✅ |
| Edit Marks | ✅ (unverified only) | ❌ | ✅ (all) |

## Teacher Workflow

1. **View Assignments**: `GET /marks/teacher/assignments`
2. **Select Exam & Subject**: From assigned classes/subjects
3. **Get Students**: `GET /marks/students?exam_id=xxx&subject_id=xxx&class_group_id=xxx`
4. **Enter Marks**: `POST /marks/bulk`
5. **View Entered Marks**: `GET /marks/teacher?exam_id=xxx`

## Clerk Workflow

1. **View All Results**: `GET /marks/results`
2. **Filter by Class**: `GET /marks/results?class_group_id=xxx`
3. **Filter by Exam**: `GET /marks/results?exam_id=xxx`
4. **View Exam Results**: `GET /marks/exam/:examId`
5. **View Class Results**: `GET /marks/class/:classGroupId`
6. **View Student Marksheet**: `GET /marks/marksheet/:studentId`
7. **Verify Pending Marks**: `GET /marks/pending` → `POST /marks/verify`

## Example Queries

### Get All Results for Clerk (SQL)
```sql
SELECT 
  m.*,
  s.roll_number,
  p.full_name as student_name,
  e.name as exam_name,
  sub.name as subject_name,
  cg.name as class_name
FROM marks m
JOIN students s ON s.id = m.student_id
JOIN profiles p ON p.id = s.profile_id
JOIN exams e ON e.id = m.exam_id
JOIN subjects sub ON sub.id = m.subject_id
JOIN class_groups cg ON cg.id = s.class_group_id
WHERE m.school_id = $1
  AND ($2::uuid IS NULL OR s.class_group_id = $2)
  AND ($3::uuid IS NULL OR m.exam_id = $3)
ORDER BY e.start_date DESC, s.roll_number;
```

### Get Teacher's Assigned Classes/Subjects
```sql
SELECT DISTINCT
  ta.class_group_id,
  ta.subject_id,
  cg.name as class_name,
  sub.name as subject_name
FROM teacher_assignments ta
JOIN class_groups cg ON cg.id = ta.class_group_id
JOIN subjects sub ON sub.id = ta.subject_id
WHERE ta.teacher_id = $1
  AND ta.school_id = $2;
```

## Constraints & Validations

1. **Unique Constraint**: `UNIQUE(student_id, exam_id, subject_id)` prevents duplicate marks
2. **Teacher Validation**: Checks `teacher_assignments` before allowing marks entry
3. **Clerk Read-Only**: RLS policies prevent clerks from modifying marks
4. **School Isolation**: All queries filtered by `school_id`

## Indexes for Performance

- `idx_marks_student` - Fast student lookups
- `idx_marks_exam` - Fast exam filtering
- `idx_marks_subject` - Fast subject filtering
- `idx_marks_school` - Fast school filtering
- `idx_students_class` - Fast class filtering
- `idx_students_section` - Fast section filtering

## Best Practices

1. **Create Exam First**: Set up exam with name, term, dates
2. **Add Subjects**: Link subjects to exam via `exam_subjects`
3. **Assign Teachers**: Ensure teachers are assigned to classes/subjects
4. **Enter Marks**: Teachers enter marks for their assigned classes
5. **Verify Marks**: Clerks verify marks before students can see them
6. **View Results**: Clerks can view all results with various filters

