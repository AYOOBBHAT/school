import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';

// Use adminSupabase for all operations
const supabase = adminSupabase;

const router = Router();

// Schema for teacher attendance assignment
const teacherAttendanceAssignmentSchema = Joi.object({
  teacher_id: Joi.string().uuid().required(),
  class_group_id: Joi.string().uuid().required(),
  section_id: Joi.string().uuid().allow('', null).optional(),
  is_active: Joi.boolean().default(true)
});

// Get all attendance assignments for a school
router.get('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    const { data, error } = await adminSupabase
      .from('teacher_attendance_assignments')
      .select(`
        *,
        teacher:teacher_id(id, full_name, email),
        class_group:class_group_id(id, name),
        section:section_id(id, name)
      `)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ assignments: data || [] });
  } catch (err: any) {
    console.error('[teacher-attendance-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Create teacher attendance assignment (Principal only)
router.post('/', requireRoles(['principal']), async (req, res) => {
  const { error, value } = teacherAttendanceAssignmentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    const payload = {
      ...value,
      school_id: user.schoolId,
      section_id: value.section_id || null
    };

    const { data, error: dbError } = await supabase
      .from('teacher_attendance_assignments')
      .insert(payload)
      .select(`
        *,
        teacher:teacher_id(id, full_name, email),
        class_group:class_group_id(id, name),
        section:section_id(id, name)
      `)
      .single();

    if (dbError) {
      if (dbError.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'This teacher is already assigned to mark attendance for this class' });
      }
      return res.status(400).json({ error: dbError.message });
    }

    return res.status(201).json({ assignment: data });
  } catch (err: any) {
    console.error('[teacher-attendance-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Update teacher attendance assignment (Principal only)
router.put('/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = teacherAttendanceAssignmentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    const updateData: any = {
      ...value,
      section_id: value.section_id || null
    };

    const { data, error: dbError } = await supabase
      .from('teacher_attendance_assignments')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('school_id', user.schoolId)
      .select(`
        *,
        teacher:teacher_id(id, full_name, email),
        class_group:class_group_id(id, name),
        section:section_id(id, name)
      `)
      .single();

    if (dbError) return res.status(400).json({ error: dbError.message });
    if (!data) return res.status(404).json({ error: 'Assignment not found' });

    return res.json({ assignment: data });
  } catch (err: any) {
    console.error('[teacher-attendance-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete teacher attendance assignment (Principal only)
router.delete('/:id', requireRoles(['principal']), async (req, res) => {
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    const { error } = await supabase
      .from('teacher_attendance_assignments')
      .delete()
      .eq('id', req.params.id)
      .eq('school_id', user.schoolId);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[teacher-attendance-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get assignments for a specific teacher
router.get('/teacher/:teacherId', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  // Teachers can only view their own assignments
  if (user.role === 'teacher' && user.id !== req.params.teacherId) {
    return res.status(403).json({ error: 'Forbidden' });
  }


  try {
    const { data, error } = await adminSupabase
      .from('teacher_attendance_assignments')
      .select(`
        *,
        class_group:class_group_id(id, name),
        section:section_id(id, name)
      `)
      .eq('teacher_id', req.params.teacherId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ assignments: data || [] });
  } catch (err: any) {
    console.error('[teacher-attendance-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

