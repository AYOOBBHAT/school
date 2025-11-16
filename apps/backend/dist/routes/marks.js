import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const verifySchema = Joi.object({
    marks_id: Joi.string().uuid().required()
});
const markSchema = Joi.object({
    student_id: Joi.string().uuid().required(),
    exam_id: Joi.string().uuid().required(),
    subject_id: Joi.string().uuid().required(),
    marks_obtained: Joi.number().min(0).required(),
    max_marks: Joi.number().positive().required(),
    school_id: Joi.string().uuid().required()
});
const bulkMarksSchema = Joi.object({
    marks: Joi.array().items(markSchema).required()
});
// Get exams for the school
router.get('/exams', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
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
            .select('*')
            .eq('school_id', user.schoolId)
            .order('start_date', { ascending: false });
        if (error) {
            console.error('[marks] Error fetching exams:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.json({ exams: exams || [] });
    }
    catch (err) {
        console.error('[marks] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Bulk save marks (for teachers)
router.post('/bulk', requireRoles(['teacher', 'principal', 'clerk']), async (req, res) => {
    const { error, value } = bulkMarksSchema.validate(req.body);
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
        const invalidRecords = value.marks.filter((m) => m.school_id !== user.schoolId);
        if (invalidRecords.length > 0) {
            return res.status(403).json({ error: 'Some records do not belong to your school' });
        }
        // For teachers, verify they are assigned to the subject and class
        if (user.role === 'teacher') {
            const subjectIds = [...new Set(value.marks.map((m) => m.subject_id))];
            const { data: assignments, error: assignmentError } = await adminSupabase
                .from('teacher_assignments')
                .select('subject_id, class_group_id')
                .eq('teacher_id', user.id)
                .in('subject_id', subjectIds);
            if (assignmentError || !assignments || assignments.length === 0) {
                return res.status(403).json({ error: 'You are not assigned to this subject' });
            }
            const assignedSubjectIds = assignments.map((a) => a.subject_id);
            const unauthorizedSubjects = subjectIds.filter((id) => !assignedSubjectIds.includes(id));
            if (unauthorizedSubjects.length > 0) {
                return res.status(403).json({ error: 'You are not assigned to all the subjects in this request' });
            }
        }
        // Get student class groups to verify they match teacher assignments
        const studentIds = [...new Set(value.marks.map((m) => m.student_id))];
        const { data: students, error: studentsError } = await adminSupabase
            .from('students')
            .select('id, class_group_id')
            .in('id', studentIds)
            .eq('school_id', user.schoolId);
        if (studentsError) {
            return res.status(400).json({ error: studentsError.message });
        }
        // Insert marks (upsert: delete existing and insert new)
        const marksData = value.marks.map((m) => ({
            student_id: m.student_id,
            exam_id: m.exam_id,
            subject_id: m.subject_id,
            marks_obtained: m.marks_obtained,
            max_marks: m.max_marks,
            school_id: m.school_id
        }));
        // Delete existing marks for the same students, exam, and subject
        const examId = marksData[0].exam_id;
        const subjectId = marksData[0].subject_id;
        await adminSupabase
            .from('marks')
            .delete()
            .in('student_id', studentIds)
            .eq('exam_id', examId)
            .eq('subject_id', subjectId);
        // Insert new marks
        const { data: inserted, error: insertError } = await adminSupabase
            .from('marks')
            .insert(marksData)
            .select();
        if (insertError) {
            console.error('[marks] Error saving marks:', insertError);
            return res.status(400).json({ error: insertError.message });
        }
        console.log('[marks] Marks saved successfully:', inserted?.length, 'records');
        return res.json({ marks: inserted, message: 'Marks saved successfully' });
    }
    catch (err) {
        console.error('[marks] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
router.post('/verify', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { error, value } = verifySchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error: dbError } = await supabase
        .from('marks')
        .update({ verified_by: user.id })
        .eq('id', value.marks_id)
        .eq('school_id', user.schoolId)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.json({ marks: data });
});
router.get('/pending', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error } = await supabase
        .from('marks')
        .select(`
      id,
      student_id,
      exam_id,
      subject_id,
      marks_obtained,
      max_marks,
      exams:exam_id (
        id,
        name,
        term,
        start_date,
        end_date
      ),
      subjects:subject_id (
        id,
        name,
        code
      ),
      students:student_id (
        id,
        roll_number,
        profile:profiles!students_profile_id_fkey (
          id,
          full_name,
          email
        )
      )
    `)
        .eq('school_id', user.schoolId)
        .is('verified_by', null)
        .order('exam_id', { ascending: false });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ marks: data || [] });
});
router.get('/marksheet/:student_id', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const studentId = req.params.student_id;
    const { data, error } = await supabase
        .from('marks')
        .select('exam_id, subject_id, marks_obtained, max_marks, exams(name, term), subjects(name, code)')
        .eq('student_id', studentId)
        .eq('school_id', user.schoolId)
        .order('exam_id');
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ marksheet: data });
});
export default router;
