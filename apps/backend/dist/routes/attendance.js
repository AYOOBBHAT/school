import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        let query = adminSupabase
            .from('attendance')
            .select(`
        id,
        student_id,
        date,
        status,
        class_group_id,
        students:student_id(
          id,
          roll_number,
          profile:profiles!students_profile_id_fkey(
            id,
            full_name,
            email
          )
        )
      `)
            .eq('class_group_id', class_group_id)
            .eq('date', date)
            .eq('school_id', user.schoolId);
        if (student_id) {
            query = query.eq('student_id', student_id);
        }
        const { data: attendance, error } = await query.order('date', { ascending: false });
        if (error) {
            console.error('[attendance] Error fetching attendance:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.json({ attendance: attendance || [] });
    }
    catch (err) {
        console.error('[attendance] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
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
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
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
        // Upsert attendance records (update if exists, insert if not)
        const attendanceData = value.attendance.map((a) => ({
            student_id: a.student_id,
            class_group_id: a.class_group_id,
            date: a.date,
            status: a.status,
            school_id: a.school_id,
            marked_by: user.id
        }));
        // Delete existing records for the same students and date
        const studentIds = attendanceData.map((a) => a.student_id);
        const date = attendanceData[0].date;
        const classGroupId = attendanceData[0].class_group_id;
        await adminSupabase
            .from('attendance')
            .delete()
            .in('student_id', studentIds)
            .eq('date', date)
            .eq('class_group_id', classGroupId);
        // Insert new records
        const { data: inserted, error: insertError } = await adminSupabase
            .from('attendance')
            .insert(attendanceData)
            .select();
        if (insertError) {
            console.error('[attendance] Error saving attendance:', insertError);
            return res.status(400).json({ error: insertError.message });
        }
        console.log('[attendance] Attendance saved successfully:', inserted?.length, 'records');
        return res.json({ attendance: inserted, message: 'Attendance saved successfully' });
    }
    catch (err) {
        console.error('[attendance] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
