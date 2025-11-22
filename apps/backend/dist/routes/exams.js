import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const scheduleEntrySchema = Joi.object({
    subject_id: Joi.string().uuid().required(),
    exam_date: Joi.date().required(),
    time_from: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(), // HH:MM format
    time_to: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required() // HH:MM format
});
const examSchema = Joi.object({
    name: Joi.string().required(),
    term: Joi.string().allow('', null),
    schedule: Joi.array().items(scheduleEntrySchema).min(1).required(), // At least one schedule entry
    class_group_ids: Joi.array().items(Joi.string().uuid()).optional() // If empty/null, applies to all classes
});
// Create exam
router.post('/', requireRoles(['principal']), async (req, res) => {
    const { error, value } = examSchema.validate(req.body);
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
        // Calculate start_date and end_date from schedule entries
        const dates = value.schedule.map((entry) => new Date(entry.exam_date));
        const start_date = new Date(Math.min(...dates.map((d) => d.getTime())));
        const end_date = new Date(Math.max(...dates.map((d) => d.getTime())));
        // Create exam
        const { data: exam, error: examError } = await adminSupabase
            .from('exams')
            .insert({
            name: value.name,
            term: value.term || null,
            start_date: start_date.toISOString().split('T')[0],
            end_date: end_date.toISOString().split('T')[0],
            school_id: user.schoolId
        })
            .select()
            .single();
        if (examError) {
            console.error('[exams] Error creating exam:', examError);
            return res.status(400).json({ error: examError.message });
        }
        // Create schedule entries
        const scheduleEntries = value.schedule.map((entry) => ({
            exam_id: exam.id,
            subject_id: entry.subject_id,
            exam_date: entry.exam_date,
            time_from: entry.time_from,
            time_to: entry.time_to,
            school_id: user.schoolId
        }));
        const { error: scheduleError } = await adminSupabase
            .from('exam_schedule')
            .insert(scheduleEntries);
        if (scheduleError) {
            console.error('[exams] Error creating schedule:', scheduleError);
            // Rollback exam creation
            await adminSupabase.from('exams').delete().eq('id', exam.id);
            return res.status(400).json({ error: scheduleError.message });
        }
        // If class_group_ids provided, link exam to those classes
        if (value.class_group_ids && value.class_group_ids.length > 0) {
            const examClassLinks = value.class_group_ids.map((classId) => ({
                exam_id: exam.id,
                class_group_id: classId
            }));
            const { error: linkError } = await adminSupabase
                .from('exam_classes')
                .insert(examClassLinks);
            if (linkError) {
                console.error('[exams] Error linking exam to classes:', linkError);
                // Rollback exam and schedule creation
                await adminSupabase.from('exam_schedule').delete().eq('exam_id', exam.id);
                await adminSupabase.from('exams').delete().eq('id', exam.id);
                return res.status(400).json({ error: linkError.message });
            }
        }
        // Fetch exam with class links and schedule
        const { data: examWithClasses, error: fetchError } = await adminSupabase
            .from('exams')
            .select(`
        *,
        exam_classes:exam_classes(
          class_group:class_groups(id, name)
        ),
        exam_schedule:exam_schedule(
          id,
          subject_id,
          exam_date,
          time_from,
          time_to,
          subject:subjects(id, name, code)
        )
      `)
            .eq('id', exam.id)
            .single();
        if (fetchError) {
            console.error('[exams] Error fetching exam with classes:', fetchError);
            return res.json({ exam });
        }
        return res.json({ exam: examWithClasses });
    }
    catch (err) {
        console.error('[exams] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get all exams for the school
router.get('/', requireRoles(['principal', 'teacher', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const { data: exams, error } = await adminSupabase
            .from('exams')
            .select(`
        *,
        exam_classes:exam_classes(
          class_group:class_groups(id, name)
        ),
        exam_schedule:exam_schedule(
          id,
          subject_id,
          exam_date,
          time_from,
          time_to,
          subject:subjects(id, name, code)
        )
      `)
            .eq('school_id', user.schoolId)
            .order('start_date', { ascending: false });
        if (error) {
            console.error('[exams] Error fetching exams:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.json({ exams: exams || [] });
    }
    catch (err) {
        console.error('[exams] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Add subjects to an exam
router.post('/:examId/subjects', requireRoles(['principal']), async (req, res) => {
    const { error, value } = Joi.object({
        subject_ids: Joi.array().items(Joi.string().uuid()).min(1).required()
    }).validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { examId } = req.params;
    try {
        // Verify exam belongs to school
        const { data: exam, error: examError } = await adminSupabase
            .from('exams')
            .select('id, school_id')
            .eq('id', examId)
            .eq('school_id', user.schoolId)
            .single();
        if (examError || !exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        // Create exam_subjects entries
        const examSubjects = value.subject_ids.map((subjectId) => ({
            exam_id: examId,
            subject_id: subjectId,
            school_id: user.schoolId
        }));
        const { data, error: insertError } = await adminSupabase
            .from('exam_subjects')
            .upsert(examSubjects, {
            onConflict: 'exam_id,subject_id',
            ignoreDuplicates: false
        })
            .select();
        if (insertError) {
            console.error('[exams] Error adding subjects:', insertError);
            return res.status(400).json({ error: insertError.message });
        }
        return res.json({ exam_subjects: data });
    }
    catch (err) {
        console.error('[exams] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get subjects for an exam
router.get('/:examId/subjects', requireRoles(['principal', 'teacher', 'clerk', 'student', 'parent']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { examId } = req.params;
    try {
        const { data, error } = await adminSupabase
            .from('exam_subjects')
            .select(`
        subject_id,
        subjects:subject_id(
          id,
          name,
          code
        )
      `)
            .eq('exam_id', examId)
            .eq('school_id', user.schoolId);
        if (error) {
            console.error('[exams] Error fetching subjects:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.json({ subjects: data || [] });
    }
    catch (err) {
        console.error('[exams] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get exams for a specific student (only exams assigned to their class or all classes)
router.get('/student', requireRoles(['student']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
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
        ),
        exam_schedule:exam_schedule(
          id,
          subject_id,
          exam_date,
          time_from,
          time_to,
          subject:subjects(id, name, code)
        )
      `)
            .eq('school_id', user.schoolId)
            .order('start_date', { ascending: false });
        if (examsError) {
            console.error('[exams] Error fetching exams:', examsError);
            return res.status(400).json({ error: examsError.message });
        }
        // Filter exams: show if exam has no class restrictions OR if exam is assigned to student's class
        const studentExams = (allExams || []).filter((exam) => {
            const examClasses = exam.exam_classes || [];
            // If no class restrictions, exam applies to all classes
            if (examClasses.length === 0) {
                return true;
            }
            // If exam has class restrictions, check if student's class is included
            return examClasses.some((ec) => ec.class_group?.id === student.class_group_id);
        });
        return res.json({ exams: studentExams });
    }
    catch (err) {
        console.error('[exams] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
