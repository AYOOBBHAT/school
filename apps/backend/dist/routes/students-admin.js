import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Get all students for principal/clerk (grouped by class) or students for teacher's assigned classes
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { class_group_id, subject_id, section_id } = req.query;
    // Use service role key to bypass RLS for admin operations
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        let classGroupIds = [];
        // For teachers, only show students from their assigned classes
        if (user.role === 'teacher') {
            const { data: assignments, error: assignmentError } = await adminSupabase
                .from('teacher_assignments')
                .select('class_group_id, section_id, subject_id')
                .eq('teacher_id', user.id)
                .eq('school_id', user.schoolId);
            if (assignmentError) {
                console.error('[students-admin] Error fetching teacher assignments:', assignmentError);
                return res.status(400).json({ error: assignmentError.message });
            }
            if (!assignments || assignments.length === 0) {
                return res.json({ classes: [], unassigned: [], total_students: 0 });
            }
            // Filter by query params if provided
            let filteredAssignments = assignments;
            if (class_group_id) {
                filteredAssignments = filteredAssignments.filter((a) => a.class_group_id === class_group_id);
            }
            if (subject_id) {
                filteredAssignments = filteredAssignments.filter((a) => a.subject_id === subject_id);
            }
            if (section_id) {
                filteredAssignments = filteredAssignments.filter((a) => a.section_id === section_id);
            }
            classGroupIds = [...new Set(filteredAssignments.map((a) => a.class_group_id))];
            if (classGroupIds.length === 0) {
                return res.json({ classes: [], unassigned: [], total_students: 0 });
            }
        }
        // Build query
        let query = adminSupabase
            .from('students')
            .select(`
        id,
        roll_number,
        status,
        admission_date,
        class_group_id,
        section_id,
        profile:profiles!students_profile_id_fkey(
          id,
          full_name,
          email,
          phone,
          created_at
        ),
        class_groups:class_group_id(
          id,
          name,
          description,
          classifications:class_classifications(
            classification_value:classification_values(
              id,
              value,
              classification_type:classification_types(id, name)
            )
          )
        ),
        sections:section_id(
          id,
          name
        )
      `)
            .eq('school_id', user.schoolId)
            .eq('status', 'active'); // Only show active students
        // For teachers, filter by assigned classes
        if (user.role === 'teacher' && classGroupIds.length > 0) {
            query = query.in('class_group_id', classGroupIds);
        }
        // If class_group_id is provided in query (for all roles), filter by it
        if (class_group_id && user.role !== 'teacher') {
            query = query.eq('class_group_id', class_group_id);
        }
        // If section_id is provided, filter by it
        if (section_id) {
            query = query.eq('section_id', section_id);
        }
        const { data: students, error } = await query.order('roll_number', { ascending: true, nullsFirst: false });
        if (error) {
            console.error('[students-admin] Error fetching students:', error);
            return res.status(400).json({ error: error.message });
        }
        // Transform classifications for classes
        const studentsWithClasses = (students || []).map((student) => {
            if (student.class_groups) {
                const classGroup = student.class_groups;
                const classifications = (classGroup.classifications || []).map((cc) => ({
                    type: cc.classification_value?.classification_type?.name || 'Unknown',
                    value: cc.classification_value?.value || 'Unknown',
                    type_id: cc.classification_value?.classification_type?.id || '',
                    value_id: cc.classification_value?.id || ''
                }));
                return {
                    ...student,
                    class_groups: {
                        ...classGroup,
                        classifications
                    }
                };
            }
            return student;
        });
        // Group students by class
        const studentsByClass = {};
        const unassignedStudents = [];
        studentsWithClasses.forEach((student) => {
            if (student.class_group_id && student.class_groups) {
                const classId = student.class_group_id;
                if (!studentsByClass[classId]) {
                    studentsByClass[classId] = [];
                }
                studentsByClass[classId].push(student);
            }
            else {
                unassignedStudents.push(student);
            }
        });
        // Get class details for each class
        const classesWithStudents = Object.keys(studentsByClass).map(classId => {
            const classStudents = studentsByClass[classId];
            const firstStudent = classStudents[0];
            return {
                id: classId,
                name: firstStudent.class_groups?.name || 'Unknown Class',
                description: firstStudent.class_groups?.description || '',
                classifications: firstStudent.class_groups?.classifications || [],
                students: classStudents.map((s) => ({
                    id: s.id,
                    roll_number: s.roll_number,
                    status: s.status,
                    admission_date: s.admission_date,
                    section_id: s.section_id,
                    section_name: s.sections?.name || null,
                    profile: s.profile
                })),
                student_count: classStudents.length
            };
        });
        // Sort classes by name
        classesWithStudents.sort((a, b) => a.name.localeCompare(b.name));
        return res.json({
            classes: classesWithStudents,
            unassigned: unassignedStudents.map((s) => ({
                id: s.id,
                roll_number: s.roll_number,
                status: s.status,
                admission_date: s.admission_date,
                profile: s.profile
            })),
            total_students: studentsWithClasses.length
        });
    }
    catch (err) {
        console.error('[students-admin] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Update student class assignment
router.put('/:studentId', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { studentId } = req.params;
    const { class_group_id, section_id, roll_number } = req.body;
    try {
        // Verify student belongs to the school
        const { data: student, error: studentError } = await adminSupabase
            .from('students')
            .select('id, school_id, profile_id')
            .eq('id', studentId)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student not found or access denied' });
        }
        // If class_group_id is provided, verify it belongs to the school
        if (class_group_id) {
            const { data: classGroup, error: classError } = await adminSupabase
                .from('class_groups')
                .select('id, school_id')
                .eq('id', class_group_id)
                .eq('school_id', user.schoolId)
                .single();
            if (classError || !classGroup) {
                return res.status(400).json({ error: 'Invalid class group or access denied' });
            }
            // If section_id is provided, verify it belongs to the class_group
            if (section_id) {
                const { data: section, error: sectionError } = await adminSupabase
                    .from('sections')
                    .select('id, class_group_id')
                    .eq('id', section_id)
                    .eq('class_group_id', class_group_id)
                    .single();
                if (sectionError || !section) {
                    return res.status(400).json({ error: 'Invalid section or section does not belong to the class' });
                }
            }
        }
        // Update student record
        const updateData = {};
        if (class_group_id !== undefined) {
            updateData.class_group_id = class_group_id || null;
        }
        if (section_id !== undefined) {
            updateData.section_id = section_id || null;
        }
        if (roll_number !== undefined) {
            updateData.roll_number = roll_number || null;
        }
        const { data: updatedStudent, error: updateError } = await adminSupabase
            .from('students')
            .update(updateData)
            .eq('id', studentId)
            .select()
            .single();
        if (updateError) {
            console.error('[students-admin] Error updating student:', updateError);
            return res.status(400).json({ error: updateError.message });
        }
        console.log('[students-admin] Student updated successfully:', updatedStudent);
        return res.json({ student: updatedStudent, message: 'Student updated successfully' });
    }
    catch (err) {
        console.error('[students-admin] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Promote/demote a student (move to different class)
router.post('/:studentId/promote', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { studentId } = req.params;
    const { target_class_id, section_id } = req.body;
    if (!target_class_id) {
        return res.status(400).json({ error: 'target_class_id is required' });
    }
    try {
        // Verify student belongs to the school
        const { data: student, error: studentError } = await adminSupabase
            .from('students')
            .select('id, school_id, class_group_id')
            .eq('id', studentId)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student not found or access denied' });
        }
        // Verify target class belongs to the school
        const { data: targetClass, error: classError } = await adminSupabase
            .from('class_groups')
            .select('id, school_id, name')
            .eq('id', target_class_id)
            .eq('school_id', user.schoolId)
            .single();
        if (classError || !targetClass) {
            return res.status(400).json({ error: 'Invalid target class or access denied' });
        }
        // If section_id is provided, verify it belongs to the target class
        if (section_id) {
            const { data: section, error: sectionError } = await adminSupabase
                .from('sections')
                .select('id, class_group_id')
                .eq('id', section_id)
                .eq('class_group_id', target_class_id)
                .single();
            if (sectionError || !section) {
                return res.status(400).json({ error: 'Invalid section or section does not belong to the target class' });
            }
        }
        // Update student's class
        const updateData = {
            class_group_id: target_class_id
        };
        if (section_id) {
            updateData.section_id = section_id;
        }
        else {
            updateData.section_id = null; // Clear section if not provided
        }
        const { data: updatedStudent, error: updateError } = await adminSupabase
            .from('students')
            .update(updateData)
            .eq('id', studentId)
            .select()
            .single();
        if (updateError) {
            console.error('[students-admin] Error promoting student:', updateError);
            return res.status(400).json({ error: updateError.message });
        }
        console.log('[students-admin] Student promoted successfully:', {
            student_id: studentId,
            from_class: student.class_group_id,
            to_class: target_class_id
        });
        return res.json({
            student: updatedStudent,
            message: `Student moved to ${targetClass.name}`
        });
    }
    catch (err) {
        console.error('[students-admin] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Promote entire class (bulk operation)
router.post('/class/:classId/promote', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { classId } = req.params;
    const { target_class_id, clear_sections } = req.body;
    if (!target_class_id) {
        return res.status(400).json({ error: 'target_class_id is required' });
    }
    try {
        // Verify source class belongs to the school
        const { data: sourceClass, error: sourceClassError } = await adminSupabase
            .from('class_groups')
            .select('id, school_id, name')
            .eq('id', classId)
            .eq('school_id', user.schoolId)
            .single();
        if (sourceClassError || !sourceClass) {
            return res.status(404).json({ error: 'Source class not found or access denied' });
        }
        // Verify target class belongs to the school
        const { data: targetClass, error: targetClassError } = await adminSupabase
            .from('class_groups')
            .select('id, school_id, name')
            .eq('id', target_class_id)
            .eq('school_id', user.schoolId)
            .single();
        if (targetClassError || !targetClass) {
            return res.status(400).json({ error: 'Invalid target class or access denied' });
        }
        // Get all students in the source class
        const { data: students, error: studentsError } = await adminSupabase
            .from('students')
            .select('id')
            .eq('class_group_id', classId)
            .eq('school_id', user.schoolId)
            .eq('status', 'active');
        if (studentsError) {
            return res.status(400).json({ error: studentsError.message });
        }
        if (!students || students.length === 0) {
            return res.status(400).json({ error: 'No active students found in the source class' });
        }
        // Update all students
        const updateData = {
            class_group_id: target_class_id
        };
        if (clear_sections) {
            updateData.section_id = null;
        }
        const { error: updateError } = await adminSupabase
            .from('students')
            .update(updateData)
            .eq('class_group_id', classId)
            .eq('school_id', user.schoolId)
            .eq('status', 'active');
        if (updateError) {
            console.error('[students-admin] Error promoting class:', updateError);
            return res.status(400).json({ error: updateError.message });
        }
        console.log('[students-admin] Class promoted successfully:', {
            from_class: sourceClass.name,
            to_class: targetClass.name,
            students_count: students.length
        });
        return res.json({
            message: `Successfully moved ${students.length} students from ${sourceClass.name} to ${targetClass.name}`,
            students_moved: students.length,
            from_class: sourceClass.name,
            to_class: targetClass.name
        });
    }
    catch (err) {
        console.error('[students-admin] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
