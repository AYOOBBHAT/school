# Student Exam Results Module - Design

## Overview
A dedicated exam results module for students to view their detailed results for a selected exam, including subject-wise breakdown and overall summary.

## Requirements

### Subject-wise Marks
For each subject in the exam:
- Subject name
- Marks obtained
- Max marks
- Percentage per subject
- Pass/Fail status per subject

### Overall Exam Summary
- `total_obtained`: Sum of all marks obtained
- `total_max`: Sum of all max marks
- `total_percentage`: (total_obtained / total_max) * 100
- `grade`: A/B/C/Fail based on total percentage
- `overall_result`: "Pass" if all subjects passed, else "Fail"

### Pass/Fail Criteria
- **Per Subject**: Pass if percentage >= 40% (configurable)
- **Overall**: Pass if ALL subjects passed

### Grade Calculation
- A: >= 80%
- B: >= 60%
- C: >= 40%
- Fail: < 40%

## API Endpoint

### Get Exam Results for Student
```
GET /students/exam-results/:examId
```

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

## Implementation Logic

### 1. Get Student Record
- Verify student exists
- Get student_id from profile_id

### 2. Get Exam Details
- Verify exam exists and belongs to school
- Get exam information

### 3. Get Marks for Exam
- Fetch all marks for student + exam
- Only verified marks (verified_by is not null)
- Include subject details

### 4. Calculate Subject-wise Results
For each subject:
```typescript
percentage = (marks_obtained / max_marks) * 100
status = percentage >= 40 ? "Pass" : "Fail"
```

### 5. Calculate Overall Summary
```typescript
total_obtained = sum of all marks_obtained
total_max = sum of all max_marks
total_percentage = (total_obtained / total_max) * 100

if (total_percentage >= 80) grade = "A"
else if (total_percentage >= 60) grade = "B"
else if (total_percentage >= 40) grade = "C"
else grade = "Fail"

overall_result = all subjects passed ? "Pass" : "Fail"
```

## Security

- Students can only see their own results (enforced by RLS)
- Only verified marks are shown
- Exam must belong to student's school

## Edge Cases

1. **No marks entered**: Return empty subjects array, summary with zeros
2. **Some subjects missing**: Show only available subjects
3. **Unverified marks**: Exclude from results
4. **Zero max_marks**: Handle division by zero (percentage = 0)

