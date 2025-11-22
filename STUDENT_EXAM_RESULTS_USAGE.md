# Student Exam Results Module - Usage Guide

## Overview
A comprehensive exam results module for students to view their detailed results, including subject-wise breakdown and overall summary.

## API Endpoints

### 1. Get All Exam Results (All Exams)
```
GET /students/marks
```
Returns all verified marks grouped by exam, with pass/fail per subject and overall result.

**Response:**
```json
{
  "marks": [
    {
      "exam": {
        "id": "uuid",
        "name": "Mid-Term Exam",
        "term": "First Term",
        "start_date": "2024-01-15",
        "end_date": "2024-01-20"
      },
      "subjects": [
        {
          "subject": {
            "id": "uuid",
            "name": "Mathematics",
            "code": "MATH"
          },
          "marks_obtained": 85,
          "max_marks": 100,
          "percentage": "85.00",
          "status": "Pass"
        },
        {
          "subject": {
            "id": "uuid",
            "name": "Science",
            "code": "SCI"
          },
          "marks_obtained": 35,
          "max_marks": 100,
          "percentage": "35.00",
          "status": "Fail"
        }
      ],
      "total_obtained": 120,
      "total_max": 200,
      "total_percentage": "60.00",
      "grade": "B",
      "overall_result": "Fail"
    }
  ],
  "raw": [...]
}
```

### 2. Get Exam Results for Specific Exam
```
GET /students/exam-results/:examId
```
Returns detailed results for a selected exam.

**Response:**
```json
{
  "exam": {
    "id": "uuid",
    "name": "Mid-Term Exam",
    "term": "First Term",
    "start_date": "2024-01-15",
    "end_date": "2024-01-20"
  },
  "subjects": [
    {
      "subject": {
        "id": "uuid",
        "name": "Mathematics",
        "code": "MATH"
      },
      "marks_obtained": 85,
      "max_marks": 100,
      "percentage": "85.00",
      "status": "Pass"
    },
    {
      "subject": {
        "id": "uuid",
        "name": "Science",
        "code": "SCI"
      },
      "marks_obtained": 35,
      "max_marks": 100,
      "percentage": "35.00",
      "status": "Fail"
    }
  ],
  "summary": {
    "total_obtained": 120,
    "total_max": 200,
    "total_percentage": "60.00",
    "grade": "B",
    "overall_result": "Fail"
  }
}
```

## Response Fields

### Subject-wise Marks
- `subject`: Subject details (id, name, code)
- `marks_obtained`: Marks obtained by student
- `max_marks`: Maximum marks for the subject
- `percentage`: Percentage calculated as (marks_obtained / max_marks) * 100
- `status`: "Pass" if percentage >= 40%, else "Fail"

### Overall Summary
- `total_obtained`: Sum of all marks obtained across all subjects
- `total_max`: Sum of all max marks across all subjects
- `total_percentage`: (total_obtained / total_max) * 100
- `grade`: 
  - "A" if total_percentage >= 80%
  - "B" if total_percentage >= 60%
  - "C" if total_percentage >= 40%
  - "Fail" if total_percentage < 40%
- `overall_result`: 
  - "Pass" if ALL subjects have status = "Pass"
  - "Fail" if ANY subject has status = "Fail"

## Pass/Fail Criteria

### Per Subject
- **Pass**: Percentage >= 40%
- **Fail**: Percentage < 40%

### Overall Result
- **Pass**: ALL subjects passed
- **Fail**: ANY subject failed

## Grade Calculation

Based on total percentage:
- **A**: >= 80%
- **B**: >= 60%
- **C**: >= 40%
- **Fail**: < 40%

## Security

- ✅ Students can only see their own results (enforced by RLS)
- ✅ Only verified marks are shown (verified_by is not null)
- ✅ Exam must belong to student's school
- ✅ Student must be authenticated

## Example Usage

### View All Exam Results
```bash
GET /students/marks
Authorization: Bearer <student_token>
```

### View Specific Exam Results
```bash
GET /students/exam-results/abc123
Authorization: Bearer <student_token>
```

## Frontend Integration

### Display Subject-wise Marks
```typescript
{result.subjects.map((subject: any) => (
  <div key={subject.subject.id}>
    <h3>{subject.subject.name}</h3>
    <p>Marks: {subject.marks_obtained} / {subject.max_marks}</p>
    <p>Percentage: {subject.percentage}%</p>
    <p>Status: 
      <span className={subject.status === 'Pass' ? 'text-green-600' : 'text-red-600'}>
        {subject.status}
      </span>
    </p>
  </div>
))}
```

### Display Overall Summary
```typescript
<div>
  <h2>Overall Summary</h2>
  <p>Total: {summary.total_obtained} / {summary.total_max}</p>
  <p>Percentage: {summary.total_percentage}%</p>
  <p>Grade: {summary.grade}</p>
  <p>Result: 
    <span className={summary.overall_result === 'Pass' ? 'text-green-600' : 'text-red-600'}>
      {summary.overall_result}
    </span>
  </p>
</div>
```

## Edge Cases

1. **No marks entered**: Returns empty subjects array, summary with zeros
2. **Some subjects missing**: Shows only available subjects
3. **Unverified marks**: Excluded from results
4. **Zero max_marks**: Handles division by zero (percentage = 0)
5. **No subjects in exam**: Returns empty subjects array

## Notes

- The pass threshold is set to 40% (configurable in code)
- Only verified marks are shown to students
- Grade calculation uses total percentage across all subjects
- Overall result is "Pass" only if ALL subjects passed

