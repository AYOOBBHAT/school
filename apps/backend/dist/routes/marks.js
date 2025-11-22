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
        .select(`
      id,
      exam_id,
      subject_id,
      marks_obtained,
      max_marks,
      verified_by,
      exams:exam_id(id, name, term, start_date, end_date),
      subjects:subject_id(id, name, code)
    `)
        .eq('student_id', studentId)
        .eq('school_id', user.schoolId)
        .order('exam_id', { ascending: false });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ marksheet: data });
});
// ============================================
// CLERK ENDPOINTS - View All Results
// ============================================
// Get all results with filters (Clerk can view all)
router.get('/results', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { class_group_id, section_id, exam_id, student_id, subject_id } = req.query;
    try {
        // First, get student IDs if filtering by class/section
        let studentIds = null;
        if (class_group_id || section_id) {
            let studentQuery = adminSupabase
                .from('students')
                .select('id')
                .eq('school_id', user.schoolId)
                .eq('status', 'active');
            if (class_group_id) {
                studentQuery = studentQuery.eq('class_group_id', class_group_id);
            }
            if (section_id) {
                studentQuery = studentQuery.eq('section_id', section_id);
            }
            const { data: students, error: studentsError } = await studentQuery;
            if (studentsError) {
                return res.status(400).json({ error: studentsError.message });
            }
            studentIds = (students || []).map((s) => s.id);
            // If no students found, return empty
            if (studentIds.length === 0) {
                return res.json({ results: [], count: 0 });
            }
        }
        // Build marks query
        let query = adminSupabase
            .from('marks')
            .select(`
        id,
        student_id,
        exam_id,
        subject_id,
        marks_obtained,
        max_marks,
        verified_by,
        students:student_id(
          id,
          roll_number,
          class_group_id,
          section_id,
          profile:profiles!students_profile_id_fkey(
            id,
            full_name,
            email
          ),
          class_groups:class_group_id(
            id,
            name
          ),
          sections:section_id(
            id,
            name
          )
        ),
        exams:exam_id(
          id,
          name,
          term,
          start_date,
          end_date
        ),
        subjects:subject_id(
          id,
          name,
          code
        )
      `)
            .eq('school_id', user.schoolId);
        // Apply filters
        if (studentIds) {
            query = query.in('student_id', studentIds);
        }
        else if (student_id) {
            query = query.eq('student_id', student_id);
        }
        if (exam_id) {
            query = query.eq('exam_id', exam_id);
        }
        if (subject_id) {
            query = query.eq('subject_id', subject_id);
        }
        if (exam_id) {
            query = query.eq('exam_id', exam_id);
        }
        if (student_id) {
            query = query.eq('student_id', student_id);
        }
        if (subject_id) {
            query = query.eq('subject_id', subject_id);
        }
        const { data, error } = await query;
        if (error) {
            console.error('[marks/results] Error:', error);
            return res.status(400).json({ error: error.message });
        }
        // Apply filters in application layer (since nested filters don't work well)
        let filteredData = (data || []).filter((mark) => {
            if (class_group_id && mark.students?.class_group_id !== class_group_id) {
                return false;
            }
            if (section_id && mark.students?.section_id !== section_id) {
                return false;
            }
            if (exam_id && mark.exam_id !== exam_id) {
                return false;
            }
            if (student_id && mark.student_id !== student_id) {
                return false;
            }
            if (subject_id && mark.subject_id !== subject_id) {
                return false;
            }
            return true;
        });
        // Sort
        filteredData.sort((a, b) => {
            // Sort by exam start date (desc)
            const examA = a.exams?.start_date || '';
            const examB = b.exams?.start_date || '';
            if (examA !== examB)
                return examB.localeCompare(examA);
            // Then by roll number
            const rollA = a.students?.roll_number || '';
            const rollB = b.students?.roll_number || '';
            if (rollA !== rollB)
                return rollA.localeCompare(rollB);
            // Then by subject name
            const subA = a.subjects?.name || '';
            const subB = b.subjects?.name || '';
            return subA.localeCompare(subB);
        });
        return res.json({
            results: filteredData,
            count: filteredData.length
        });
    }
    catch (err) {
        console.error('[marks/results] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get exam results (all students for an exam)
router.get('/exam/:examId', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { examId } = req.params;
    const { class_group_id, section_id } = req.query;
    try {
        let query = supabase
            .from('marks')
            .select(`
        id,
        student_id,
        subject_id,
        marks_obtained,
        max_marks,
        verified_by,
        students:student_id(
          id,
          roll_number,
          class_group_id,
          section_id,
          profile:profiles!students_profile_id_fkey(
            full_name
          ),
          class_groups:class_group_id(name),
          sections:section_id(name)
        ),
        subjects:subject_id(
          id,
          name,
          code
        )
      `)
            .eq('exam_id', examId)
            .eq('school_id', user.schoolId);
        // Filters will be applied after fetching
        const { data, error } = await query;
        if (error) {
            console.error('[marks/exam] Error:', error);
            return res.status(400).json({ error: error.message });
        }
        // Apply filters
        let filteredData = (data || []).filter((mark) => {
            if (class_group_id && mark.students?.class_group_id !== class_group_id) {
                return false;
            }
            if (section_id && mark.students?.section_id !== section_id) {
                return false;
            }
            return true;
        });
        // Sort
        filteredData.sort((a, b) => {
            const rollA = a.students?.roll_number || '';
            const rollB = b.students?.roll_number || '';
            if (rollA !== rollB)
                return rollA.localeCompare(rollB);
            const subA = a.subjects?.name || '';
            const subB = b.subjects?.name || '';
            return subA.localeCompare(subB);
        });
        // Group by student for better presentation
        const resultsByStudent = {};
        filteredData.forEach((mark) => {
            const studentId = mark.student_id;
            if (!resultsByStudent[studentId]) {
                resultsByStudent[studentId] = {
                    student: mark.students,
                    subjects: []
                };
            }
            resultsByStudent[studentId].subjects.push({
                subject: mark.subjects,
                marks_obtained: mark.marks_obtained,
                max_marks: mark.max_marks,
                percentage: mark.max_marks > 0
                    ? ((mark.marks_obtained / mark.max_marks) * 100).toFixed(2)
                    : 0,
                verified: !!mark.verified_by
            });
        });
        return res.json({
            exam_id: examId,
            results: Object.values(resultsByStudent),
            raw: filteredData
        });
    }
    catch (err) {
        console.error('[marks/exam] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get class results (all exams for a class)
router.get('/class/:classGroupId', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { classGroupId } = req.params;
    const { section_id, exam_id } = req.query;
    try {
        let query = supabase
            .from('marks')
            .select(`
        id,
        student_id,
        exam_id,
        subject_id,
        marks_obtained,
        max_marks,
        verified_by,
        students:student_id(
          id,
          roll_number,
          section_id,
          profile:profiles!students_profile_id_fkey(
            full_name
          ),
          sections:section_id(name)
        ),
        exams:exam_id(
          id,
          name,
          term,
          start_date,
          end_date
        ),
        subjects:subject_id(
          id,
          name,
          code
        )
      `)
            .eq('school_id', user.schoolId);
        const { data, error } = await query;
        if (error) {
            console.error('[marks/class] Error:', error);
            return res.status(400).json({ error: error.message });
        }
        // Apply filters
        let filteredData = (data || []).filter((mark) => {
            if (mark.students?.class_group_id !== classGroupId) {
                return false;
            }
            if (section_id && mark.students?.section_id !== section_id) {
                return false;
            }
            if (exam_id && mark.exam_id !== exam_id) {
                return false;
            }
            return true;
        });
        // Sort
        filteredData.sort((a, b) => {
            const examA = a.exams?.start_date || '';
            const examB = b.exams?.start_date || '';
            if (examA !== examB)
                return examB.localeCompare(examA);
            const rollA = a.students?.roll_number || '';
            const rollB = b.students?.roll_number || '';
            if (rollA !== rollB)
                return rollA.localeCompare(rollB);
            const subA = a.subjects?.name || '';
            const subB = b.subjects?.name || '';
            return subA.localeCompare(subB);
        });
        return res.json({
            class_group_id: classGroupId,
            results: filteredData,
            count: filteredData.length
        });
    }
    catch (err) {
        console.error('[marks/class] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get teacher's assigned classes/subjects
router.get('/teacher/assignments', requireRoles(['teacher']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { data, error } = await supabase
            .from('teacher_assignments')
            .select(`
        class_group_id,
        subject_id,
        section_id,
        class_groups:class_group_id(
          id,
          name
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
            .eq('teacher_id', user.id)
            .eq('school_id', user.schoolId);
        if (error) {
            console.error('[marks/teacher/assignments] Error:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.json({ assignments: data || [] });
    }
    catch (err) {
        console.error('[marks/teacher/assignments] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get marks for teacher (only assigned classes/subjects)
router.get('/teacher', requireRoles(['teacher']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { exam_id, class_group_id, subject_id, section_id } = req.query;
    try {
        // Get teacher's assignments
        const { data: assignments, error: assignError } = await supabase
            .from('teacher_assignments')
            .select('class_group_id, subject_id, section_id')
            .eq('teacher_id', user.id)
            .eq('school_id', user.schoolId);
        if (assignError) {
            return res.status(400).json({ error: assignError.message });
        }
        if (!assignments || assignments.length === 0) {
            return res.json({ marks: [], message: 'No assignments found' });
        }
        // Build query with teacher's assignments
        let query = supabase
            .from('marks')
            .select(`
        id,
        student_id,
        exam_id,
        subject_id,
        marks_obtained,
        max_marks,
        verified_by,
        students:student_id(
          id,
          roll_number,
          class_group_id,
          section_id,
          profile:profiles!students_profile_id_fkey(
            full_name
          ),
          class_groups:class_group_id(name),
          sections:section_id(name)
        ),
        exams:exam_id(
          id,
          name,
          term
        ),
        subjects:subject_id(
          id,
          name,
          code
        )
      `)
            .eq('school_id', user.schoolId);
        // Filter by teacher's assignments
        const classIds = [...new Set(assignments.map((a) => a.class_group_id))];
        const subjectIds = [...new Set(assignments.map((a) => a.subject_id))];
        query = query.in('students.class_group_id', classIds);
        query = query.in('subject_id', subjectIds);
        // Apply additional filters
        if (exam_id) {
            query = query.eq('exam_id', exam_id);
        }
        if (class_group_id) {
            query = query.eq('students.class_group_id', class_group_id);
        }
        if (subject_id) {
            query = query.eq('subject_id', subject_id);
        }
        if (section_id) {
            query = query.eq('students.section_id', section_id);
        }
        const { data, error } = await query
            .order('exams.start_date', { ascending: false })
            .order('students.roll_number', { ascending: true });
        if (error) {
            console.error('[marks/teacher] Error:', error);
            return res.status(400).json({ error: error.message });
        }
        return res.json({ marks: data || [] });
    }
    catch (err) {
        console.error('[marks/teacher] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
