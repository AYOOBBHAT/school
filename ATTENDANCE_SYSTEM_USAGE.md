# Attendance Management System - Usage Guide

## Overview
A comprehensive attendance system that enforces one-class-per-day per teacher, auto-detects first class, pre-fills with 'present', and handles holidays.

## Key Features

1. **One Class Per Day**: Teacher can only mark attendance for their first class of the day
2. **Auto-Detection**: System automatically determines teacher's first class from timetable
3. **Pre-filled Present**: All students default to 'present' status
4. **Locking**: Once submitted, attendance is locked and cannot be changed
5. **Holiday Handling**: Automatically prevents marking on Sundays and declared holidays
6. **Duplicate Prevention**: Prevents duplicate attendance records

## Database Schema

### Tables

1. **`timetable`**: Period schedule for classes
   - Links teachers to classes, subjects, sections
   - Defines day of week, period number, start/end time
   - Used to determine teacher's first class

2. **`school_holidays`**: Declared holidays
   - Prevents attendance marking on holidays
   - Supports recurring holidays

3. **`student_attendance`**: Student attendance records
   - Status: present, absent, late, leave, holiday
   - Locking mechanism (`is_locked`)
   - Unique constraint: `(student_id, attendance_date)`

4. **`class_attendance_lock`**: Tracks which teacher marked which class
   - Prevents multi-class marking: `unique(teacher_id, attendance_date)`
   - Prevents duplicate class marking: `unique(class_group_id, section_id, attendance_date)`

## API Endpoints

### 1. Get Teacher's First Class
```
GET /attendance/teacher/first-class?date=2024-01-15
Response: {
  isHoliday: false,
  firstClass: {
    class_group_id: "uuid",
    section_id: "uuid" | null,
    period_number: 1,
    start_time: "09:00",
    subject_name: "Mathematics",
    class_name: "Class 10"
  }
}
```

### 2. Get Students for Attendance
```
GET /attendance/students?class_group_id=xxx&section_id=xxx&date=2024-01-15
Response: {
  isHoliday: false,
  students: [
    {
      student_id: "uuid",
      roll_number: "001",
      full_name: "John Doe",
      status: "present", // Pre-filled
      existing_attendance_id: null,
      is_locked: false
    }
  ],
  date: "2024-01-15"
}
```

### 3. Check if Can Mark Attendance
```
GET /attendance/can-mark?class_group_id=xxx&section_id=xxx&date=2024-01-15
Response: {
  allowed: true,
  firstClass: { ... }
}
// OR
{
  allowed: false,
  reason: "You can only mark attendance for your first class today (Class 10, Period 1)"
}
```

### 4. Check if Holiday
```
GET /attendance/is-holiday?date=2024-01-15
Response: {
  isHoliday: true,
  reason: "Sunday" | "Holiday Name"
}
```

### 5. Mark Attendance
```
POST /attendance/mark
Body: {
  class_group_id: "uuid",
  section_id: "uuid" | null,
  date: "2024-01-15",
  attendance: [
    { student_id: "uuid", status: "present" },
    { student_id: "uuid", status: "absent" },
    { student_id: "uuid", status: "late" },
    { student_id: "uuid", status: "leave" }
  ]
}
Response: {
  message: "Attendance marked and locked successfully",
  count: 25
}
```

## Frontend Flow

### Step 1: Load Attendance Screen

```typescript
// 1. Check if holiday
const holidayCheck = await fetch('/attendance/is-holiday?date=today');
if (holidayCheck.isHoliday) {
  // Show holiday message, disable attendance
  return;
}

// 2. Get teacher's first class
const firstClass = await fetch('/attendance/teacher/first-class?date=today');
if (!firstClass.firstClass) {
  // Show "No classes today"
  return;
}

// 3. Get students for that class
const students = await fetch(
  `/attendance/students?class_group_id=${firstClass.firstClass.class_group_id}&section_id=${firstClass.firstClass.section_id}&date=today`
);

// 4. Pre-fill UI with students (all 'present' by default)
```

### Step 2: Toggle Student Status

```typescript
// Allow toggle between: present, absent, late, leave
// Disable if is_locked = true
const toggleStatus = (studentId, newStatus) => {
  if (students.find(s => s.student_id === studentId)?.is_locked) {
    return; // Can't change locked attendance
  }
  // Update local state
};
```

### Step 3: Submit Attendance

```typescript
// 1. Validate teacher can mark this class
const canMark = await fetch(
  `/attendance/can-mark?class_group_id=${classId}&section_id=${sectionId}&date=today`
);

if (!canMark.allowed) {
  alert(canMark.reason);
  return;
}

// 2. Submit attendance
const result = await fetch('/attendance/mark', {
  method: 'POST',
  body: JSON.stringify({
    class_group_id: classId,
    section_id: sectionId,
    date: today,
    attendance: students.map(s => ({
      student_id: s.student_id,
      status: s.status
    }))
  })
});

// 3. Show success, lock UI
```

## System Logic Details

### 1. Auto-Determine First Class

The system:
1. Gets teacher's timetable for the day (based on `day_of_week`)
2. Filters by `academic_year` and `is_active = true`
3. Orders by `period_number` ascending
4. Finds first period that hasn't started yet (or earliest if all passed)
5. Returns that class-section combination

### 2. Pre-fill with 'Present'

When loading students:
1. Fetch all active students in the class-section
2. Check for existing attendance records
3. If exists and locked, show locked status
4. If exists and not locked, show existing status
5. If doesn't exist, default to 'present'

### 3. Toggle Logic

- Teachers can toggle between: present, absent, late, leave
- Cannot toggle if `is_locked = true`
- Cannot toggle if status is 'holiday' (system-generated)

### 4. Save & Lock Logic

When saving:
1. Verify teacher can mark this class (first class check)
2. Check if already locked by another teacher
3. Upsert attendance records (update if exists, insert if not)
4. Set `is_locked = true` for all records
5. Create/update `class_attendance_lock` record
6. Prevent future changes

### 5. Prevent Multi-Class Attendance

Constraints:
- `unique(teacher_id, attendance_date)` in `class_attendance_lock`
- Check before saving: if teacher already marked another class, reject
- Check before saving: if class already marked by another teacher, reject

### 6. Handle Sundays/Holidays

When checking:
1. Check if `day_of_week === 0` (Sunday) → Holiday
2. Check `school_holidays` table for date → Holiday
3. If holiday:
   - Option A: Prevent marking (show message)
   - Option B: Auto-mark all as 'holiday' (system-generated)

## Example Scenarios

### Scenario 1: Normal Day
1. Teacher logs in → System detects first class (Period 1, Class 10A)
2. Loads students → All pre-filled as 'present'
3. Teacher toggles 2 students to 'absent'
4. Submits → Attendance locked
5. Teacher tries to mark another class → Blocked (already marked today)

### Scenario 2: Sunday
1. Teacher logs in → System detects it's Sunday
2. Shows message: "Today is Sunday. Attendance cannot be marked."
3. Optionally: System auto-marks all as 'holiday'

### Scenario 3: Declared Holiday
1. Principal declares holiday for "2024-01-26" (Republic Day)
2. Teacher tries to mark attendance → Blocked
3. Shows message: "Today is Republic Day. Attendance cannot be marked."

### Scenario 4: Teacher Has Multiple Classes
1. Teacher assigned to: Class 10A (Period 1), Class 11B (Period 3)
2. System detects first class: Class 10A (Period 1)
3. Teacher can only mark Class 10A
4. After marking, cannot mark Class 11B (already marked today)

## Best Practices

1. **Set up timetable first**: Before marking attendance, ensure timetable is configured
2. **Declare holidays in advance**: Add holidays to `school_holidays` table
3. **Handle edge cases**: What if teacher has no classes? What if period already passed?
4. **Lock enforcement**: Once locked, only principal/clerk can modify
5. **Audit trail**: `marked_by` and `marked_at` track who marked and when

## Migration Notes

- Old `attendance` table → New `student_attendance` table
- New fields: `is_locked`, `marked_by`, `marked_at`
- New table: `class_attendance_lock` for multi-class prevention
- New table: `timetable` for period scheduling
- New table: `school_holidays` for holiday management

