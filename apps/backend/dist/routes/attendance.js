import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { getTeacherFirstClass, isHoliday, getStudentsForAttendance, canMarkAttendance, saveAttendance } from '../utils/attendanceLogic.js';
const router = Router();
const attendanceSchema = Joi.object({
    student_id: Joi.string().uuid().required(),
    class_group_id: Joi.string().uuid().required(),
    date: Joi.string().required(),
    status: Joi.string().valid('present', 'absent', 'late').required(),
    school_id: Joi.string().uuid().required()
});
const bulkAttendanceSchema = Joi.object({
    attendance: Joi.array().items(attendanceSchema).required()
});
// Get attendance for a class and date
router.get('/', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { class_group_id, date, student_id } = req.query;
    if (!class_group_id || !date) {
        return res.status(400).json({ error: 'class_group_id and date are required' });
    }
    try {
        // Step 1: Fetch attendance records (minimal fields, no joins)
        let query = adminSupabase
            .from('student_attendance')
            .select('id, student_id, attendance_date, status, class_group_id, is_locked')
            .eq('class_group_id', class_group_id)
            .eq('attendance_date', date)
            .eq('school_id', user.schoolId);
        if (student_id) {
            query = query.eq('student_id', student_id);
        }
        const { data: attendance, error } = await query;
        if (error) {
            console.error('[attendance] Error fetching attendance:', error);
            return res.status(400).json({ error: error.message });
        }
        if (!attendance || attendance.length === 0) {
            return res.json({ attendance: [] });
        }
        // Step 2: Fetch student details separately (only if needed)
        const studentIds = [...new Set(attendance.map((a) => a.student_id))];
        const { data: students, error: studentsError } = await adminSupabase
            .from('students')
            .select('id, roll_number, profile:profiles!students_profile_id_fkey(id, full_name, email)')
            .in('id', studentIds);
        if (studentsError) {
            console.error('[attendance] Error fetching students:', studentsError);
            // Return attendance without student details rather than failing
        }
        // Step 3: Map student details to attendance records in memory
        const studentMap = new Map((students || []).map((s) => [s.id, {
                id: s.id,
                roll_number: s.roll_number,
                profile: s.profile
            }]));
        const attendanceWithStudents = attendance.map((a) => ({
            ...a,
            students: studentMap.get(a.student_id) || null
        }));
        return res.json({ attendance: attendanceWithStudents });
    }
    catch (err) {
        console.error('[attendance] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
// Bulk save attendance (for teachers)
router.post('/bulk', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
    const { error, value } = bulkAttendanceSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Verify all records belong to the school
        const invalidRecords = value.attendance.filter((a) => a.school_id !== user.schoolId);
        if (invalidRecords.length > 0) {
            return res.status(403).json({ error: 'Some records do not belong to your school' });
        }
        // For teachers, verify they are assigned to the class
        if (user.role === 'teacher') {
            const classIds = [...new Set(value.attendance.map((a) => a.class_group_id))];
            const { data: assignments, error: assignmentError } = await adminSupabase
                .from('teacher_assignments')
                .select('class_group_id')
                .eq('teacher_id', user.id)
                .in('class_group_id', classIds);
            if (assignmentError || !assignments || assignments.length === 0) {
                return res.status(403).json({ error: 'You are not assigned to this class' });
            }
            const assignedClassIds = assignments.map((a) => a.class_group_id);
            const unauthorizedClasses = classIds.filter((id) => !assignedClassIds.includes(id));
            if (unauthorizedClasses.length > 0) {
                return res.status(403).json({ error: 'You are not assigned to all the classes in this request' });
            }
        }
        // Group records by (class_group_id, date) for atomic RPC calls
        const attendanceByClassAndDate = new Map();
        value.attendance.forEach((a) => {
            const key = `${a.class_group_id}:${a.date}`;
            if (!attendanceByClassAndDate.has(key)) {
                attendanceByClassAndDate.set(key, {
                    classGroupId: a.class_group_id,
                    date: a.date,
                    records: []
                });
            }
            attendanceByClassAndDate.get(key).records.push({
                student_id: a.student_id,
                status: a.status,
                is_locked: false
            });
        });
        // Call atomic RPC function for each unique (class_group_id, date) combination
        // ✅ ONE RPC call per class/date - all writes in single transaction
        let totalAffected = 0;
        const errors = [];
        for (const { classGroupId, date, records } of attendanceByClassAndDate.values()) {
            const { data: result, error: rpcError } = await adminSupabase.rpc('mark_student_attendance_atomic', {
                p_school_id: user.schoolId,
                p_class_group_id: classGroupId,
                p_attendance_date: date,
                p_marked_by: user.id,
                p_records: records
            });
            if (rpcError || !result?.success) {
                const errorMsg = rpcError?.message || result?.error || 'Unknown error';
                console.error('[attendance] RPC error:', errorMsg);
                errors.push(`Failed for class ${classGroupId} on ${date}: ${errorMsg}`);
            }
            else {
                totalAffected += result.inserted || 0;
            }
        }
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Some attendance records failed to save',
                details: errors,
                affected: totalAffected
            });
        }
        console.log('[attendance] Attendance saved successfully:', totalAffected, 'records');
        return res.json({
            success: true,
            count: totalAffected,
            message: 'Attendance saved successfully'
        });
    }
    catch (err) {
        console.error('[attendance] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
// ============================================
// NEW ATTENDANCE SYSTEM ENDPOINTS
// ============================================
// Get teacher's first class for today
router.get('/teacher/first-class', requireRoles(['teacher']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const dateParam = req.query.date;
    const date = dateParam ? new Date(dateParam) : new Date();
    if (!user.schoolId) {
        return res.status(500).json({ error: 'School ID not found' });
    }
    try {
        // Check if holiday
        const holidayCheck = await isHoliday(date, user.schoolId, adminSupabase);
        if (holidayCheck.isHoliday) {
            return res.json({
                isHoliday: true,
                reason: holidayCheck.reason,
                message: `Today is ${holidayCheck.reason}. Attendance cannot be marked.`
            });
        }
        // Get first class
        const firstClass = await getTeacherFirstClass(user.id, date, adminSupabase);
        if (!firstClass) {
            return res.json({
                isHoliday: false,
                firstClass: null,
                message: 'No classes scheduled for you today'
            });
        }
        return res.json({
            isHoliday: false,
            firstClass
        });
    }
    catch (err) {
        console.error('[attendance/teacher/first-class] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
// Get students for attendance (pre-filled with 'present')
router.get('/students', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { class_group_id, section_id, date: dateParam } = req.query;
    if (!class_group_id) {
        return res.status(400).json({ error: 'class_group_id is required' });
    }
    const date = dateParam ? new Date(dateParam) : new Date();
    try {
        // For teachers, verify they can mark this class
        if (user.role === 'teacher') {
            const canMark = await canMarkAttendance(user.id, class_group_id, section_id || null, date, adminSupabase);
            if (!canMark.allowed) {
                return res.status(403).json({
                    error: canMark.reason,
                    firstClass: canMark.firstClass
                });
            }
        }
        if (!user.schoolId) {
            return res.status(500).json({ error: 'School ID not found' });
        }
        // Check if holiday
        const holidayCheck = await isHoliday(date, user.schoolId, adminSupabase);
        if (holidayCheck.isHoliday) {
            return res.json({
                isHoliday: true,
                reason: holidayCheck.reason,
                students: [],
                message: `Today is ${holidayCheck.reason}. Attendance cannot be marked.`
            });
        }
        // Get students
        const students = await getStudentsForAttendance(class_group_id, section_id || null, user.schoolId, date, adminSupabase);
        return res.json({
            isHoliday: false,
            students,
            date: date.toISOString().split('T')[0]
        });
    }
    catch (err) {
        console.error('[attendance/students] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
// Check if can mark attendance
router.get('/can-mark', requireRoles(['teacher']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { class_group_id, section_id, date: dateParam } = req.query;
    if (!class_group_id) {
        return res.status(400).json({ error: 'class_group_id is required' });
    }
    const date = dateParam ? new Date(dateParam) : new Date();
    try {
        const canMark = await canMarkAttendance(user.id, class_group_id, section_id || null, date, adminSupabase);
        return res.json(canMark);
    }
    catch (err) {
        console.error('[attendance/can-mark] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
// Check if holiday
router.get('/is-holiday', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { date: dateParam } = req.query;
    const date = dateParam ? new Date(dateParam) : new Date();
    if (!user.schoolId) {
        return res.status(500).json({ error: 'School ID not found' });
    }
    try {
        const holidayCheck = await isHoliday(date, user.schoolId, adminSupabase);
        return res.json(holidayCheck);
    }
    catch (err) {
        console.error('[attendance/is-holiday] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
// Mark attendance (new system with locking)
const newAttendanceSchema = Joi.object({
    class_group_id: Joi.string().uuid().required(),
    section_id: Joi.string().uuid().allow(null, '').optional(),
    date: Joi.string().required(),
    attendance: Joi.array().items(Joi.object({
        student_id: Joi.string().uuid().required(),
        status: Joi.string().valid('present', 'absent', 'late', 'leave').required()
    })).required()
});
router.post('/mark', requireRoles(['teacher']), async (req, res) => {
    const { error, value } = newAttendanceSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const date = new Date(value.date);
    if (!user.schoolId) {
        return res.status(500).json({ error: 'School ID not found' });
    }
    try {
        // Check if holiday
        const holidayCheck = await isHoliday(date, user.schoolId, adminSupabase);
        if (holidayCheck.isHoliday) {
            return res.status(400).json({
                error: `Cannot mark attendance. Today is ${holidayCheck.reason}.`
            });
        }
        // Save attendance
        await saveAttendance(user.id, value.class_group_id, value.section_id || null, user.schoolId, date, value.attendance, adminSupabase);
        return res.json({
            message: 'Attendance marked and locked successfully',
            count: value.attendance.length
        });
    }
    catch (err) {
        console.error('[attendance/mark] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to mark attendance';
        return res.status(400).json({ error: errorMessage });
    }
});
export default router;
