import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const assignmentSchema = Joi.object({
  teacher_id: Joi.string().uuid().required(),
  class_group_id: Joi.string().uuid().required(),
  subject_id: Joi.string().uuid().required(),
  section_id: Joi.string().uuid().allow(null, '')
});

// Get all teacher assignments
router.get('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // First, verify the table exists by checking if we can query it
    const { data: testQuery, error: testError } = await adminSupabase
      .from('teacher_assignments')
      .select('id')
      .limit(1);

    if (testError && testError.message?.includes('schema cache')) {
      console.error('[teacher-assignments] Schema cache error. Table may not exist or PostgREST needs restart.');
      return res.status(500).json({ 
        error: 'Database schema cache issue. Please ensure the teacher_assignments table exists and PostgREST has been restarted or schema cache has been refreshed.' 
      });
    }

    const { data: assignments, error } = await adminSupabase
      .from('teacher_assignments')
      .select(`
        id,
        teacher_id,
        class_group_id,
        subject_id,
        section_id,
        created_at,
        teacher:profiles!teacher_assignments_teacher_id_fkey(
          id,
          full_name,
          email,
          role
        ),
        class_groups:class_group_id(
          id,
          name,
          description
        ),
        subjects:subject_id(
          id,
          name,
          code
        ),
        sections:section_id(
          id,
          name
        )
      `)
      .eq('school_id', user.schoolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[teacher-assignments] Error fetching assignments:', error);
      if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
        return res.status(500).json({ 
          error: 'The teacher_assignments table is not available. Please ensure migrations have been run and PostgREST schema cache has been refreshed.' 
        });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.json({ assignments: assignments || [] });
  } catch (err: any) {
    console.error('[teacher-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get assignments for a specific teacher
router.get('/teacher/:teacherId', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacherId } = req.params;
  
  // Teachers can only see their own assignments
  if (user.role === 'teacher' && user.id !== teacherId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    const { data: assignments, error } = await adminSupabase
      .from('teacher_assignments')
      .select(`
        id,
        class_group_id,
        subject_id,
        section_id,
        created_at,
        class_groups:class_group_id(
          id,
          name,
          description
        ),
        subjects:subject_id(
          id,
          name,
          code
        ),
        sections:section_id(
          id,
          name
        )
      `)
      .eq('teacher_id', teacherId)
      .eq('school_id', user.schoolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[teacher-assignments] Error fetching teacher assignments:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ assignments: assignments || [] });
  } catch (err: any) {
    console.error('[teacher-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Create teacher assignment
router.post('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = assignmentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // First, verify the table exists
    const { error: tableCheckError } = await adminSupabase
      .from('teacher_assignments')
      .select('id')
      .limit(1);

    if (tableCheckError && (tableCheckError.message?.includes('schema cache') || tableCheckError.message?.includes('not found'))) {
      console.error('[teacher-assignments] Schema cache error when creating assignment.');
      return res.status(500).json({ 
        error: 'Database schema cache issue. Please ensure the teacher_assignments table exists and PostgREST has been restarted or schema cache has been refreshed.' 
      });
    }

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

    // Verify class belongs to the school
    const { data: classGroup, error: classError } = await adminSupabase
      .from('class_groups')
      .select('id, school_id')
      .eq('id', value.class_group_id)
      .eq('school_id', user.schoolId)
      .single();

    if (classError || !classGroup) {
      return res.status(400).json({ error: 'Invalid class group or access denied' });
    }

    // Verify subject belongs to the school
    const { data: subject, error: subjectError } = await adminSupabase
      .from('subjects')
      .select('id, school_id')
      .eq('id', value.subject_id)
      .eq('school_id', user.schoolId)
      .single();

    if (subjectError || !subject) {
      return res.status(400).json({ error: 'Invalid subject or access denied' });
    }

    // If section_id is provided, verify it belongs to the class
    if (value.section_id) {
      const { data: section, error: sectionError } = await adminSupabase
        .from('sections')
        .select('id, class_group_id')
        .eq('id', value.section_id)
        .eq('class_group_id', value.class_group_id)
        .single();

      if (sectionError || !section) {
        return res.status(400).json({ error: 'Invalid section or section does not belong to the class' });
      }
    }

    // Create assignment
    const { data: assignment, error: insertError } = await adminSupabase
      .from('teacher_assignments')
      .insert({
        teacher_id: value.teacher_id,
        class_group_id: value.class_group_id,
        subject_id: value.subject_id,
        section_id: value.section_id || null,
        school_id: user.schoolId
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'This assignment already exists' });
      }
      console.error('[teacher-assignments] Error creating assignment:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    console.log('[teacher-assignments] Assignment created successfully:', assignment);
    return res.status(201).json({ assignment });
  } catch (err: any) {
    console.error('[teacher-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete teacher assignment
router.delete('/:assignmentId', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { assignmentId } = req.params;

  try {
    // Verify assignment belongs to the school
    const { data: assignment, error: assignmentError } = await adminSupabase
      .from('teacher_assignments')
      .select('id, school_id')
      .eq('id', assignmentId)
      .eq('school_id', user.schoolId)
      .single();

    if (assignmentError || !assignment) {
      return res.status(404).json({ error: 'Assignment not found or access denied' });
    }

    const { error: deleteError } = await adminSupabase
      .from('teacher_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      console.error('[teacher-assignments] Error deleting assignment:', deleteError);
      return res.status(400).json({ error: deleteError.message });
    }

    return res.json({ message: 'Assignment deleted successfully' });
  } catch (err: any) {
    console.error('[teacher-assignments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

