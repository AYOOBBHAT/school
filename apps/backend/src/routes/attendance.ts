import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
import {
  getTeacherFirstClass,
  isHoliday,
  getStudentsForAttendance,
  canMarkAttendance,
  saveAttendance,
  handleHolidayAttendance
} from '../utils/attendanceLogic.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

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
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { class_group_id, date, student_id } = req.query;

  if (!class_group_id || !date) {
    return res.status(400).json({ error: 'class_group_id and date are required' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    let query = adminSupabase
      .from('student_attendance')
      .select(`
        id,
        student_id,
        attendance_date,
        status,
        class_group_id,
        is_locked,
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
      .eq('class_group_id', class_group_id as string)
      .eq('attendance_date', date as string)
      .eq('school_id', user.schoolId);

    if (student_id) {
      query = query.eq('student_id', student_id as string);
    }

    const { data: attendance, error } = await query.order('attendance_date', { ascending: false });

    if (error) {
      console.error('[attendance] Error fetching attendance:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ attendance: attendance || [] });
  } catch (err: any) {
    console.error('[attendance] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Bulk save attendance (for teachers)
router.post('/bulk', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
  const { error, value } = bulkAttendanceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify all records belong to the school
    const invalidRecords = value.attendance.filter((a: any) => a.school_id !== user.schoolId);
    if (invalidRecords.length > 0) {
      return res.status(403).json({ error: 'Some records do not belong to your school' });
    }

    // For teachers, verify they are assigned to the class
    if (user.role === 'teacher') {
      const classIds = [...new Set(value.attendance.map((a: any) => a.class_group_id))] as string[];
      const { data: assignments, error: assignmentError } = await adminSupabase
        .from('teacher_assignments')
        .select('class_group_id')
        .eq('teacher_id', user.id)
        .in('class_group_id', classIds);

      if (assignmentError || !assignments || assignments.length === 0) {
        return res.status(403).json({ error: 'You are not assigned to this class' });
      }

      const assignedClassIds = assignments.map((a: any) => a.class_group_id);
      const unauthorizedClasses = classIds.filter((id: string) => !assignedClassIds.includes(id));
      if (unauthorizedClasses.length > 0) {
        return res.status(403).json({ error: 'You are not assigned to all the classes in this request' });
      }
    }

    // Upsert attendance records (update if exists, insert if not)
    const attendanceData = value.attendance.map((a: any) => ({
      student_id: a.student_id,
      class_group_id: a.class_group_id,
      attendance_date: a.date,
      status: a.status,
      school_id: a.school_id,
      marked_by: user.id,
      is_locked: false // Old bulk endpoint doesn't lock
    }));

    // Delete existing records for the same students and date
    const studentIds = attendanceData.map((a: any) => a.student_id);
    const attendanceDate = attendanceData[0].attendance_date;
    const classGroupId = attendanceData[0].class_group_id;

    await adminSupabase
      .from('student_attendance')
      .delete()
      .in('student_id', studentIds)
      .eq('attendance_date', attendanceDate)
      .eq('class_group_id', classGroupId);

    // Insert new records
    const { data: inserted, error: insertError } = await adminSupabase
      .from('student_attendance')
      .insert(attendanceData)
      .select();

    if (insertError) {
      console.error('[attendance] Error saving attendance:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    console.log('[attendance] Attendance saved successfully:', inserted?.length, 'records');
    return res.json({ attendance: inserted, message: 'Attendance saved successfully' });
  } catch (err: any) {
    console.error('[attendance] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ============================================
// NEW ATTENDANCE SYSTEM ENDPOINTS
// ============================================

// Get teacher's first class for today
router.get('/teacher/first-class', requireRoles(['teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const dateParam = req.query.date as string;
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
  } catch (err: any) {
    console.error('[attendance/teacher/first-class] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get students for attendance (pre-filled with 'present')
router.get('/students', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { class_group_id, section_id, date: dateParam } = req.query;
  
  if (!class_group_id) {
    return res.status(400).json({ error: 'class_group_id is required' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const date = dateParam ? new Date(dateParam as string) : new Date();

  try {
    // For teachers, verify they can mark this class
    if (user.role === 'teacher') {
      const canMark = await canMarkAttendance(
        user.id,
        class_group_id as string,
        (section_id as string) || null,
        date,
        adminSupabase
      );
      
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
    const students = await getStudentsForAttendance(
      class_group_id as string,
      (section_id as string) || null,
      user.schoolId,
      date,
      adminSupabase
    );

    return res.json({
      isHoliday: false,
      students,
      date: date.toISOString().split('T')[0]
    });
  } catch (err: any) {
    console.error('[attendance/students] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Check if can mark attendance
router.get('/can-mark', requireRoles(['teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { class_group_id, section_id, date: dateParam } = req.query;
  
  if (!class_group_id) {
    return res.status(400).json({ error: 'class_group_id is required' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const date = dateParam ? new Date(dateParam as string) : new Date();

  try {
    const canMark = await canMarkAttendance(
      user.id,
      class_group_id as string,
      (section_id as string) || null,
      date,
      adminSupabase
    );

    return res.json(canMark);
  } catch (err: any) {
    console.error('[attendance/can-mark] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Check if holiday
router.get('/is-holiday', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { date: dateParam } = req.query;
  const date = dateParam ? new Date(dateParam as string) : new Date();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  if (!user.schoolId) {
    return res.status(500).json({ error: 'School ID not found' });
  }

  try {
    const holidayCheck = await isHoliday(date, user.schoolId, adminSupabase);
    return res.json(holidayCheck);
  } catch (err: any) {
    console.error('[attendance/is-holiday] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Mark attendance (new system with locking)
const newAttendanceSchema = Joi.object({
  class_group_id: Joi.string().uuid().required(),
  section_id: Joi.string().uuid().allow(null, '').optional(),
  date: Joi.string().required(),
  attendance: Joi.array().items(
    Joi.object({
      student_id: Joi.string().uuid().required(),
      status: Joi.string().valid('present', 'absent', 'late', 'leave').required()
    })
  ).required()
});

router.post('/mark', requireRoles(['teacher']), async (req, res) => {
  const { error, value } = newAttendanceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
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
    await saveAttendance(
      user.id,
      value.class_group_id,
      value.section_id || null,
      user.schoolId,
      date,
      value.attendance,
      adminSupabase
    );

    return res.json({ 
      message: 'Attendance marked and locked successfully',
      count: value.attendance.length
    });
  } catch (err: any) {
    console.error('[attendance/mark] Error:', err);
    return res.status(400).json({ error: err.message || 'Failed to mark attendance' });
  }
});

export default router;

