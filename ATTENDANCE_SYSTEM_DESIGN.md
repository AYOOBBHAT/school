# Attendance Management System Design

## Overview
A comprehensive attendance system that enforces:
- One class per day per teacher (first class only)
- Auto-detection of teacher's first class from timetable
- Pre-filled 'present' status
- Locking after submission
- Holiday/Sunday handling
- Duplicate prevention

## Database Schema

### 1. Timetable (Period Schedule)
```sql
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
```

### 2. School Holidays
```sql
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
```

### 3. Student Attendance (Enhanced)
```sql
create table if not exists student_attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  attendance_date date not null,
  status text check (status in ('present', 'absent', 'late', 'leave', 'holiday')) not null,
  
  -- Locking
  marked_by uuid references profiles(id) not null,
  marked_at timestamp default now(),
  is_locked boolean default false, -- Locked after submission
  
  remarks text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Prevent duplicate attendance for same student on same date
  unique(student_id, attendance_date)
);

-- Index for class-level locking check
create unique index idx_class_attendance_lock 
  on student_attendance(class_group_id, attendance_date, marked_by) 
  where is_locked = true;
```

### 4. Class Attendance Lock (Track which teacher marked which class)
```sql
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
  unique(class_group_id, section_id, attendance_date)
);
```

## System Logic

### 1. Auto-Determine Teacher's First Class

```typescript
async function getTeacherFirstClass(
  teacherId: string,
  date: Date,
  adminSupabase: any
): Promise<{
  class_group_id: string;
  section_id: string | null;
  period_number: number;
  start_time: string;
} | null> {
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
  const academicYear = date.getFullYear();
  
  // Get current time
  const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM format
  
  // Get teacher's timetable for today
  const { data: timetable, error } = await adminSupabase
    .from('timetable')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('day_of_week', dayOfWeek)
    .eq('academic_year', academicYear)
    .eq('is_active', true)
    .order('period_number', { ascending: true });
  
  if (error || !timetable || timetable.length === 0) {
    return null;
  }
  
  // Find first period that hasn't started yet, or the earliest period
  const upcomingPeriods = timetable.filter((t: any) => 
    t.start_time >= currentTime
  );
  
  // If no upcoming periods, return the last period of the day
  // Otherwise, return the first upcoming period
  const firstClass = upcomingPeriods.length > 0 
    ? upcomingPeriods[0]
    : timetable[0];
  
  return {
    class_group_id: firstClass.class_group_id,
    section_id: firstClass.section_id,
    period_number: firstClass.period_number,
    start_time: firstClass.start_time
  };
}
```

### 2. Check if Sunday/Holiday

```typescript
async function isHoliday(
  date: Date,
  schoolId: string,
  adminSupabase: any
): Promise<boolean> {
  const dateStr = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  
  // Check if Sunday
  if (dayOfWeek === 0) {
    return true;
  }
  
  // Check if declared holiday
  const { data: holiday, error } = await adminSupabase
    .from('school_holidays')
    .select('id')
    .eq('school_id', schoolId)
    .eq('holiday_date', dateStr)
    .maybeSingle();
  
  return !!holiday;
}
```

### 3. Pre-fill with 'Present'

```typescript
async function getStudentsForAttendance(
  classGroupId: string,
  sectionId: string | null,
  schoolId: string,
  adminSupabase: any
): Promise<Array<{
  student_id: string;
  roll_number: string;
  full_name: string;
  status: 'present'; // Default
}>> {
  let query = adminSupabase
    .from('students')
    .select(`
      id,
      roll_number,
      profile:profiles!students_profile_id_fkey(
        full_name
      )
    `)
    .eq('class_group_id', classGroupId)
    .eq('school_id', schoolId)
    .eq('status', 'active');
  
  if (sectionId) {
    query = query.eq('section_id', sectionId);
  }
  
  const { data: students, error } = await query.order('roll_number', { ascending: true });
  
  if (error) throw new Error(error.message);
  
  return (students || []).map((s: any) => ({
    student_id: s.id,
    roll_number: s.roll_number || 'N/A',
    full_name: s.profile?.full_name || 'N/A',
    status: 'present' as const
  }));
}
```

### 4. Save & Lock Logic

```typescript
async function saveAttendance(
  teacherId: string,
  classGroupId: string,
  sectionId: string | null,
  date: Date,
  attendanceRecords: Array<{
    student_id: string;
    status: 'present' | 'absent' | 'late' | 'leave';
  }>,
  adminSupabase: any
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  
  // 1. Check if teacher already marked attendance for another class today
  const { data: existingLock, error: lockError } = await adminSupabase
    .from('class_attendance_lock')
    .select('class_group_id')
    .eq('teacher_id', teacherId)
    .eq('attendance_date', dateStr)
    .maybeSingle();
  
  if (existingLock && existingLock.class_group_id !== classGroupId) {
    throw new Error('You have already marked attendance for another class today');
  }
  
  // 2. Check if this class is already locked by another teacher
  const { data: classLock, error: classLockError } = await adminSupabase
    .from('class_attendance_lock')
    .select('teacher_id')
    .eq('class_group_id', classGroupId)
    .eq('section_id', sectionId || null)
    .eq('attendance_date', dateStr)
    .maybeSingle();
  
  if (classLock && classLock.teacher_id !== teacherId) {
    throw new Error('This class attendance has already been marked by another teacher');
  }
  
  // 3. Insert/update attendance records
  const attendanceData = attendanceRecords.map((record) => ({
    student_id: record.student_id,
    class_group_id: classGroupId,
    section_id: sectionId,
    attendance_date: dateStr,
    status: record.status,
    marked_by: teacherId,
    is_locked: true
  }));
  
  // Upsert attendance (update if exists, insert if not)
  for (const record of attendanceData) {
    await adminSupabase
      .from('student_attendance')
      .upsert(record, {
        onConflict: 'student_id,attendance_date'
      });
  }
  
  // 4. Create/update class lock
  await adminSupabase
    .from('class_attendance_lock')
    .upsert({
      class_group_id: classGroupId,
      section_id: sectionId,
      school_id: (await getSchoolId(teacherId, adminSupabase)),
      teacher_id: teacherId,
      attendance_date: dateStr
    }, {
      onConflict: 'teacher_id,attendance_date'
    });
}
```

### 5. Prevent Multi-Class Attendance

```typescript
async function canMarkAttendance(
  teacherId: string,
  classGroupId: string,
  date: Date,
  adminSupabase: any
): Promise<{ allowed: boolean; reason?: string }> {
  const dateStr = date.toISOString().split('T')[0];
  
  // Check if teacher already marked for another class
  const { data: existing } = await adminSupabase
    .from('class_attendance_lock')
    .select('class_group_id')
    .eq('teacher_id', teacherId)
    .eq('attendance_date', dateStr)
    .maybeSingle();
  
  if (existing && existing.class_group_id !== classGroupId) {
    return {
      allowed: false,
      reason: `You have already marked attendance for another class today`
    };
  }
  
  // Check if this is teacher's first class
  const firstClass = await getTeacherFirstClass(teacherId, date, adminSupabase);
  
  if (!firstClass) {
    return {
      allowed: false,
      reason: 'No classes scheduled for you today'
    };
  }
  
  if (firstClass.class_group_id !== classGroupId) {
    return {
      allowed: false,
      reason: `You can only mark attendance for your first class today (Period ${firstClass.period_number})`
    };
  }
  
  return { allowed: true };
}
```

### 6. Handle Holidays

```typescript
async function handleHolidayAttendance(
  schoolId: string,
  date: Date,
  adminSupabase: any
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  
  if (!(await isHoliday(date, schoolId, adminSupabase))) {
    return; // Not a holiday
  }
  
  // Get all active students
  const { data: students, error } = await adminSupabase
    .from('students')
    .select('id, class_group_id, section_id')
    .eq('school_id', schoolId)
    .eq('status', 'active');
  
  if (error) throw new Error(error.message);
  
  // Auto-mark all as holiday
  const holidayAttendance = (students || []).map((s: any) => ({
    student_id: s.id,
    class_group_id: s.class_group_id,
    section_id: s.section_id,
    attendance_date: dateStr,
    status: 'holiday',
    marked_by: null, // System-generated
    is_locked: true
  }));
  
  // Upsert holiday attendance
  for (const record of holidayAttendance) {
    await adminSupabase
      .from('student_attendance')
      .upsert(record, {
        onConflict: 'student_id,attendance_date'
      });
  }
}
```

## API Endpoints

### 1. Get Teacher's First Class for Today
```
GET /attendance/teacher/first-class?date=2024-01-15
```

### 2. Get Students for Attendance (Pre-filled)
```
GET /attendance/students?class_group_id=xxx&section_id=xxx&date=2024-01-15
```

### 3. Save Attendance (with locking)
```
POST /attendance/mark
Body: {
  class_group_id: "uuid",
  section_id: "uuid" | null,
  date: "2024-01-15",
  attendance: [
    { student_id: "uuid", status: "present" },
    { student_id: "uuid", status: "absent" }
  ]
}
```

### 4. Check if Can Mark Attendance
```
GET /attendance/can-mark?class_group_id=xxx&date=2024-01-15
```

### 5. Check if Holiday
```
GET /attendance/is-holiday?date=2024-01-15
```

## Frontend Flow

1. **Load Attendance Screen**:
   - Check if today is holiday → Show holiday message
   - Get teacher's first class → Auto-select
   - Get students → Pre-fill with 'present'
   - Check if already marked → Show locked message

2. **Toggle Status**:
   - Allow toggle between: present, absent, late, leave
   - Disable if locked

3. **Submit**:
   - Validate teacher can mark this class
   - Save attendance
   - Lock the record
   - Show success message

4. **Prevent Multi-Class**:
   - Disable other class options if already marked
   - Show warning if trying to mark different class

