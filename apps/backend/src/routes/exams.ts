import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const examSchema = Joi.object({
  name: Joi.string().required(),
  term: Joi.string().allow('', null),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  class_group_ids: Joi.array().items(Joi.string().uuid()).optional() // If empty/null, applies to all classes
});

// Create exam
router.post('/', requireRoles(['principal']), async (req, res) => {
  const { error, value } = examSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Create exam
    const { data: exam, error: examError } = await adminSupabase
      .from('exams')
      .insert({
        name: value.name,
        term: value.term || null,
        start_date: value.start_date,
        end_date: value.end_date,
        school_id: user.schoolId
      })
      .select()
      .single();

    if (examError) {
      console.error('[exams] Error creating exam:', examError);
      return res.status(400).json({ error: examError.message });
    }

    // If class_group_ids provided, link exam to those classes
    if (value.class_group_ids && value.class_group_ids.length > 0) {
      const examClassLinks = value.class_group_ids.map((classId: string) => ({
        exam_id: exam.id,
        class_group_id: classId
      }));

      const { error: linkError } = await adminSupabase
        .from('exam_classes')
        .insert(examClassLinks);

      if (linkError) {
        console.error('[exams] Error linking exam to classes:', linkError);
        // Rollback exam creation
        await adminSupabase.from('exams').delete().eq('id', exam.id);
        return res.status(400).json({ error: linkError.message });
      }
    }

    // Fetch exam with class links
    const { data: examWithClasses, error: fetchError } = await adminSupabase
      .from('exams')
      .select(`
        *,
        exam_classes:exam_classes(
          class_group:class_groups(id, name)
        )
      `)
      .eq('id', exam.id)
      .single();

    if (fetchError) {
      console.error('[exams] Error fetching exam with classes:', fetchError);
      return res.json({ exam });
    }

    return res.json({ exam: examWithClasses });
  } catch (err: any) {
    console.error('[exams] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get all exams for the school
router.get('/', requireRoles(['principal', 'teacher', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    const { data: exams, error } = await adminSupabase
      .from('exams')
      .select(`
        *,
        exam_classes:exam_classes(
          class_group:class_groups(id, name)
        )
      `)
      .eq('school_id', user.schoolId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[exams] Error fetching exams:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ exams: exams || [] });
  } catch (err: any) {
    console.error('[exams] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get exams for a specific student (only exams assigned to their class or all classes)
router.get('/student', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Get student's class
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('class_group_id')
      .eq('profile_id', user.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Get all exams for the school
    const { data: allExams, error: examsError } = await adminSupabase
      .from('exams')
      .select(`
        *,
        exam_classes:exam_classes(
          class_group:class_groups(id, name)
        )
      `)
      .eq('school_id', user.schoolId)
      .order('start_date', { ascending: false });

    if (examsError) {
      console.error('[exams] Error fetching exams:', examsError);
      return res.status(400).json({ error: examsError.message });
    }

    // Filter exams: show if exam has no class restrictions OR if exam is assigned to student's class
    const studentExams = (allExams || []).filter((exam: any) => {
      const examClasses = exam.exam_classes || [];
      // If no class restrictions, exam applies to all classes
      if (examClasses.length === 0) {
        return true;
      }
      // If exam has class restrictions, check if student's class is included
      return examClasses.some((ec: any) => ec.class_group?.id === student.class_group_id);
    });

    return res.json({ exams: studentExams });
  } catch (err: any) {
    console.error('[exams] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

