/**
 * Attendance Management Logic
 * Handles teacher first class detection, holiday checking, and attendance locking
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

/**
 * Get teacher's first class for a given date based on timetable
 */
export async function getTeacherFirstClass(
  teacherId: string,
  date: Date,
  adminSupabase: any
): Promise<{
  class_group_id: string;
  section_id: string | null;
  period_number: number;
  start_time: string;
  subject_id: string;
  subject_name: string;
  class_name: string;
} | null> {
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
  const academicYear = date.getFullYear();
  
  // Get current time
  const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM format
  
  // Get teacher's timetable for today
  const { data: timetable, error } = await adminSupabase
    .from('timetable')
    .select(`
      *,
      class_groups:class_group_id(id, name),
      subjects:subject_id(id, name)
    `)
    .eq('teacher_id', teacherId)
    .eq('day_of_week', dayOfWeek)
    .eq('academic_year', academicYear)
    .eq('is_active', true)
    .order('period_number', { ascending: true });
  
  if (error) {
    console.error('[getTeacherFirstClass] Error:', error);
    throw new Error(`Failed to get timetable: ${error.message}`);
  }
  
  if (!timetable || timetable.length === 0) {
    return null;
  }
  
  // Find first period that hasn't started yet, or the earliest period
  const upcomingPeriods = timetable.filter((t: any) => 
    t.start_time >= currentTime
  );
  
  // If no upcoming periods, return the first period of the day
  // Otherwise, return the first upcoming period
  const firstClass = upcomingPeriods.length > 0 
    ? upcomingPeriods[0]
    : timetable[0];
  
  return {
    class_group_id: firstClass.class_group_id,
    section_id: firstClass.section_id,
    period_number: firstClass.period_number,
    start_time: firstClass.start_time,
    subject_id: firstClass.subject_id,
    subject_name: firstClass.subjects?.name || 'N/A',
    class_name: firstClass.class_groups?.name || 'N/A'
  };
}

/**
 * Check if a date is Sunday or a declared holiday
 */
export async function isHoliday(
  date: Date,
  schoolId: string,
  adminSupabase: any
): Promise<{ isHoliday: boolean; reason?: string }> {
  const dateStr = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  
  // Check if Sunday
  if (dayOfWeek === 0) {
    return { isHoliday: true, reason: 'Sunday' };
  }
  
  // Check if declared holiday
  const { data: holiday, error } = await adminSupabase
    .from('school_holidays')
    .select('holiday_name')
    .eq('school_id', schoolId)
    .eq('holiday_date', dateStr)
    .maybeSingle();
  
  if (error) {
    console.error('[isHoliday] Error:', error);
    // Don't throw, just return false
    return { isHoliday: false };
  }
  
  if (holiday) {
    return { isHoliday: true, reason: holiday.holiday_name };
  }
  
  return { isHoliday: false };
}

/**
 * Get students for attendance (pre-filled with 'present')
 */
export async function getStudentsForAttendance(
  classGroupId: string,
  sectionId: string | null,
  schoolId: string,
  date: Date,
  adminSupabase: any
): Promise<Array<{
  student_id: string;
  roll_number: string;
  full_name: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  existing_attendance_id?: string;
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
  
  if (error) throw new Error(`Failed to get students: ${error.message}`);
  
  const dateStr = date.toISOString().split('T')[0];
  
  // Get existing attendance for this date
  const studentIds = (students || []).map((s: any) => s.id);
  const { data: existingAttendance } = await adminSupabase
    .from('student_attendance')
    .select('student_id, id, status, is_locked')
    .in('student_id', studentIds)
    .eq('attendance_date', dateStr);
  
  const attendanceMap = new Map(
    (existingAttendance || []).map((a: any) => [a.student_id, a])
  );
  
  return (students || []).map((s: any) => {
    const existing = attendanceMap.get(s.id) as any;
    return {
      student_id: s.id,
      roll_number: s.roll_number || 'N/A',
      full_name: s.profile?.full_name || 'N/A',
      status: existing?.status || 'present',
      existing_attendance_id: existing?.id,
      is_locked: existing?.is_locked || false
    };
  });
}

/**
 * Check if teacher can mark attendance for a class
 */
export async function canMarkAttendance(
  teacherId: string,
  classGroupId: string,
  sectionId: string | null,
  date: Date,
  adminSupabase: any
): Promise<{ allowed: boolean; reason?: string; firstClass?: any }> {
  const dateStr = date.toISOString().split('T')[0];
  
  // Check if teacher already marked for another class
  const { data: existingLock, error: lockError } = await adminSupabase
    .from('class_attendance_lock')
    .select('class_group_id, section_id')
    .eq('teacher_id', teacherId)
    .eq('attendance_date', dateStr)
    .maybeSingle();
  
  if (lockError && lockError.code !== 'PGRST116') {
    console.error('[canMarkAttendance] Error:', lockError);
    return { allowed: false, reason: 'Error checking existing attendance' };
  }
  
  if (existingLock) {
    const existingSectionId = existingLock.section_id;
    if (existingLock.class_group_id !== classGroupId || 
        existingSectionId !== (sectionId || null)) {
      return {
        allowed: false,
        reason: 'You have already marked attendance for another class today'
      };
    }
    // Same class - allow if not locked
  }
  
  // Check if this class is already locked by another teacher
  const { data: classLock, error: classLockError } = await adminSupabase
    .from('class_attendance_lock')
    .select('teacher_id')
    .eq('class_group_id', classGroupId)
    .eq('section_id', sectionId || null)
    .eq('attendance_date', dateStr)
    .maybeSingle();
  
  if (classLockError && classLockError.code !== 'PGRST116') {
    console.error('[canMarkAttendance] Error:', classLockError);
    return { allowed: false, reason: 'Error checking class lock' };
  }
  
  if (classLock && classLock.teacher_id !== teacherId) {
    return {
      allowed: false,
      reason: 'This class attendance has already been marked by another teacher'
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
  
  if (firstClass.class_group_id !== classGroupId || 
      firstClass.section_id !== (sectionId || null)) {
    return {
      allowed: false,
      reason: `You can only mark attendance for your first class today (${firstClass.class_name}, Period ${firstClass.period_number})`,
      firstClass
    };
  }
  
  return { allowed: true, firstClass };
}

/**
 * Save attendance and lock it
 */
export async function saveAttendance(
  teacherId: string,
  classGroupId: string,
  sectionId: string | null,
  schoolId: string,
  date: Date,
  attendanceRecords: Array<{
    student_id: string;
    status: 'present' | 'absent' | 'late' | 'leave';
  }>,
  adminSupabase: any
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  
  // Verify teacher can mark this class
  const canMark = await canMarkAttendance(teacherId, classGroupId, sectionId, date, adminSupabase);
  if (!canMark.allowed) {
    throw new Error(canMark.reason || 'Not allowed to mark attendance');
  }
  
  // Insert/update attendance records
  const attendanceData = attendanceRecords.map((record) => ({
    student_id: record.student_id,
    class_group_id: classGroupId,
    section_id: sectionId,
    school_id: schoolId,
    attendance_date: dateStr,
    status: record.status,
    marked_by: teacherId,
    is_locked: true
  }));
  
  // Upsert attendance (update if exists, insert if not)
  for (const record of attendanceData) {
    const { error: upsertError } = await adminSupabase
      .from('student_attendance')
      .upsert(record, {
        onConflict: 'student_id,attendance_date'
      });
    
    if (upsertError) {
      console.error('[saveAttendance] Error upserting attendance:', upsertError);
      throw new Error(`Failed to save attendance: ${upsertError.message}`);
    }
  }
  
  // Create/update class lock
  const { error: lockError } = await adminSupabase
    .from('class_attendance_lock')
    .upsert({
      class_group_id: classGroupId,
      section_id: sectionId,
      school_id: schoolId,
      teacher_id: teacherId,
      attendance_date: dateStr
    }, {
      onConflict: 'teacher_id,attendance_date'
    });
  
  if (lockError) {
    console.error('[saveAttendance] Error creating lock:', lockError);
    throw new Error(`Failed to lock attendance: ${lockError.message}`);
  }
}

/**
 * Auto-mark holiday attendance for all students
 */
export async function handleHolidayAttendance(
  schoolId: string,
  date: Date,
  adminSupabase: any
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  const holidayCheck = await isHoliday(date, schoolId, adminSupabase);
  
  if (!holidayCheck.isHoliday) {
    return; // Not a holiday
  }
  
  // Get all active students
  const { data: students, error } = await adminSupabase
    .from('students')
    .select('id, class_group_id, section_id')
    .eq('school_id', schoolId)
    .eq('status', 'active');
  
  if (error) {
    console.error('[handleHolidayAttendance] Error:', error);
    throw new Error(`Failed to get students: ${error.message}`);
  }
  
  // Auto-mark all as holiday (only if not already marked)
  const holidayAttendance = (students || []).map((s: any) => ({
    student_id: s.id,
    class_group_id: s.class_group_id,
    section_id: s.section_id,
    school_id: schoolId,
    attendance_date: dateStr,
    status: 'holiday',
    marked_by: null, // System-generated
    is_locked: true
  }));
  
  // Upsert holiday attendance (only insert, don't update existing)
  for (const record of holidayAttendance) {
    const { error: upsertError } = await adminSupabase
      .from('student_attendance')
      .upsert(record, {
        onConflict: 'student_id,attendance_date',
        ignoreDuplicates: false // Update if exists
      });
    
    if (upsertError) {
      console.error('[handleHolidayAttendance] Error:', upsertError);
      // Continue with other records
    }
  }
}

