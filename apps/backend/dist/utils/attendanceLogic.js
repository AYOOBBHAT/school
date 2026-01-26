/**
 * Attendance Management Logic
 * Handles teacher first class detection, holiday checking, and attendance locking
 */
/**
 * Get teacher's first class for a given date based on timetable
 */
export async function getTeacherFirstClass(teacherId, date, adminSupabase) {
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
    const upcomingPeriods = timetable.filter((t) => t.start_time >= currentTime);
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
export async function isHoliday(date, schoolId, adminSupabase) {
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
export async function getStudentsForAttendance(classGroupId, sectionId, schoolId, date, adminSupabase) {
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
    if (error)
        throw new Error(`Failed to get students: ${error.message}`);
    const dateStr = date.toISOString().split('T')[0];
    // Get existing attendance for this date
    const studentIds = (students || []).map((s) => s.id);
    const { data: existingAttendance } = await adminSupabase
        .from('student_attendance')
        .select('student_id, id, status, is_locked')
        .in('student_id', studentIds)
        .eq('attendance_date', dateStr);
    const attendanceMap = new Map((existingAttendance || []).map((a) => [a.student_id, a]));
    return (students || []).map((s) => {
        const existing = attendanceMap.get(s.id);
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
export async function canMarkAttendance(teacherId, classGroupId, sectionId, date, adminSupabase) {
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
    // Check if teacher has attendance assignment for this class
    // Attendance assignments are separate from teaching assignments
    const { data: attendanceAssignment, error: assignmentError } = await adminSupabase
        .from('teacher_attendance_assignments')
        .select('id, class_group_id, section_id')
        .eq('teacher_id', teacherId)
        .eq('class_group_id', classGroupId)
        .eq('section_id', sectionId || null)
        .eq('is_active', true)
        .maybeSingle();
    if (assignmentError && assignmentError.code !== 'PGRST116') {
        console.error('[canMarkAttendance] Error checking attendance assignment:', assignmentError);
        return { allowed: false, reason: 'Error checking attendance assignment' };
    }
    if (!attendanceAssignment) {
        return {
            allowed: false,
            reason: 'You are not assigned to mark attendance for this class. Please contact the principal to assign you as an attendance teacher for this class.'
        };
    }
    return { allowed: true };
}
/**
 * Save attendance and lock it
 */
export async function saveAttendance(teacherId, classGroupId, sectionId, schoolId, date, attendanceRecords, adminSupabase) {
    const dateStr = date.toISOString().split('T')[0];
    // Verify teacher can mark this class
    const canMark = await canMarkAttendance(teacherId, classGroupId, sectionId, date, adminSupabase);
    if (!canMark.allowed) {
        throw new Error(canMark.reason || 'Not allowed to mark attendance');
    }
    // Prepare records for RPC call
    const records = attendanceRecords.map((record) => ({
        student_id: record.student_id,
        status: record.status,
        is_locked: true
    }));
    // ✅ Use atomic RPC function - single transaction, no race conditions
    // Uses DELETE + INSERT pattern for idempotent operations
    const { data: result, error: rpcError } = await adminSupabase.rpc('mark_student_attendance_atomic', {
        p_school_id: schoolId,
        p_class_group_id: classGroupId,
        p_attendance_date: dateStr,
        p_marked_by: teacherId,
        p_records: records
    });
    if (rpcError || !result?.success) {
        const errorMsg = rpcError?.message || result?.error || 'Unknown error';
        console.error('[saveAttendance] RPC error:', errorMsg);
        throw new Error(`Failed to save attendance: ${errorMsg}`);
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
export async function handleHolidayAttendance(schoolId, date, adminSupabase) {
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
    const holidayAttendance = (students || []).map((s) => ({
        student_id: s.id,
        class_group_id: s.class_group_id,
        section_id: s.section_id,
        school_id: schoolId,
        attendance_date: dateStr,
        status: 'holiday',
        marked_by: null, // System-generated
        is_locked: true
    }));
    // Batch UPSERT holiday attendance - single operation for all records
    // Much faster than loop - one query instead of N queries
    if (holidayAttendance.length > 0) {
        const { error: upsertError } = await adminSupabase
            .from('student_attendance')
            .upsert(holidayAttendance, {
            onConflict: 'student_id,class_group_id,attendance_date',
            ignoreDuplicates: false // Update if exists
        });
        if (upsertError) {
            console.error('[handleHolidayAttendance] Error:', upsertError);
            throw new Error(`Failed to save holiday attendance: ${upsertError.message}`);
        }
    }
}
