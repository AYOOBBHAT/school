import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const attendanceSchema = Joi.object({
  teacher_id: Joi.string().uuid().required(),
  date: Joi.string().required(),
  status: Joi.string().valid('present', 'absent', 'late', 'leave').required(),
  notes: Joi.string().allow('', null)
});

// Get teacher attendance
router.get('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacher_id, start_date, end_date } = req.query;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    let query = adminSupabase
      .from('teacher_attendance')
      .select(`
        id,
        teacher_id,
        date,
        status,
        notes,
        created_at,
        teacher:profiles!teacher_attendance_teacher_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('school_id', user.schoolId);

    if (teacher_id) {
      query = query.eq('teacher_id', teacher_id as string);
    }
    if (start_date) {
      query = query.gte('date', start_date as string);
    }
    if (end_date) {
      query = query.lte('date', end_date as string);
    }

    const { data: attendance, error } = await query.order('date', { ascending: false });

    if (error) {
      console.error('[teacher-attendance] Error fetching attendance:', error);
      return res.status(400).json({ error: error.message });
    }

    // Calculate summary
    const totalDays = attendance?.length || 0;
    const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
    const absentDays = attendance?.filter(a => a.status === 'absent').length || 0;
    const lateDays = attendance?.filter(a => a.status === 'late').length || 0;
    const leaveDays = attendance?.filter(a => a.status === 'leave').length || 0;
    const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0;

    return res.json({
      attendance: attendance || [],
      summary: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        leaveDays,
        attendancePercentage: Math.round(attendancePercentage * 100) / 100
      }
    });
  } catch (err: any) {
    console.error('[teacher-attendance] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Mark teacher attendance
router.post('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = attendanceSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify teacher belongs to the school
    const { data: teacher, error: teacherError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Check if attendance already exists for this date
    const { data: existing, error: checkError } = await adminSupabase
      .from('teacher_attendance')
      .select('id')
      .eq('teacher_id', value.teacher_id)
      .eq('date', value.date)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[teacher-attendance] Error checking existing attendance:', checkError);
      return res.status(400).json({ error: checkError.message });
    }

    const attendanceData: any = {
      teacher_id: value.teacher_id,
      date: value.date,
      status: value.status,
      school_id: user.schoolId,
      marked_by: user.id
    };

    if (value.notes) {
      attendanceData.notes = value.notes;
    }

    let result;
    if (existing) {
      // Update existing attendance
      const { data, error: updateError } = await adminSupabase
        .from('teacher_attendance')
        .update(attendanceData)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[teacher-attendance] Error updating attendance:', updateError);
        return res.status(400).json({ error: updateError.message });
      }
      result = data;
    } else {
      // Create new attendance
      const { data, error: insertError } = await adminSupabase
        .from('teacher_attendance')
        .insert(attendanceData)
        .select()
        .single();

      if (insertError) {
        console.error('[teacher-attendance] Error creating attendance:', insertError);
        return res.status(400).json({ error: insertError.message });
      }
      result = data;
    }

    console.log('[teacher-attendance] Attendance saved successfully:', result);
    return res.json({ attendance: result });
  } catch (err: any) {
    console.error('[teacher-attendance] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

