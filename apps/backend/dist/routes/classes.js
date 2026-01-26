import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
const router = Router();
const classSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    school_id: Joi.string().uuid().optional(), // Will be set from user context
    classification_value_ids: Joi.array().items(Joi.string().uuid()).optional()
});
// Get all classes for the school with their classifications
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS for consistent access
    const { data, error } = await adminSupabase
        .from('class_groups')
        .select(`
      *,
      classifications:class_classifications(
        classification_value:classification_values(
          id,
          value,
          classification_type:classification_types(id, name)
        )
      ),
      subjects:class_subjects(
        id,
        subject:subjects(id, name, code)
      )
    `)
        .eq('school_id', user.schoolId)
        .order('name', { ascending: true });
    if (error) {
        console.error('[classes] Error fetching classes:', error);
        return res.status(400).json({ error: error.message });
    }
    // Transform the data to a cleaner format
    const classes = (data || []).map(cls => {
        // The structure from Supabase is:
        // classifications: [{ classification_value: { value, classification_type: { name } } }]
        const transformedClassifications = (cls.classifications || []).map((cc) => {
            // Check if it's already transformed (from POST endpoint) or raw (from GET)
            if (cc.type && cc.value) {
                // Already in the correct format
                return cc;
            }
            // Raw format from Supabase query
            const classificationValue = cc.classification_value;
            if (!classificationValue) {
                console.warn(`[classes] Missing classification_value in:`, cc);
                return null;
            }
            const classificationType = classificationValue.classification_type;
            if (!classificationType) {
                console.warn(`[classes] Missing classification_type in:`, classificationValue);
                return null;
            }
            return {
                type: classificationType.name,
                value: classificationValue.value,
                type_id: classificationType.id,
                value_id: classificationValue.id
            };
        }).filter((c) => c !== null); // Remove any null entries
        // Transform subjects
        const transformedSubjects = (cls.subjects || []).map((cs) => {
            if (cs.subject) {
                return {
                    id: cs.subject.id,
                    name: cs.subject.name,
                    code: cs.subject.code,
                    class_subject_id: cs.id
                };
            }
            return null;
        }).filter((s) => s !== null);
        console.log(`[classes] Class "${cls.name}" has ${transformedClassifications.length} classifications and ${transformedSubjects.length} subjects`);
        return {
            ...cls,
            classifications: transformedClassifications,
            subjects: transformedSubjects
        };
    });
    console.log(`[classes] Returning ${classes.length} classes with classifications`);
    return res.json({ classes });
});
// Create a new class
router.post('/', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS for admin operations
    const insertPayload = {
        name: value.name,
        description: value.description || null,
        school_id: user.schoolId
    };
    console.log('[classes] Creating class with payload:', insertPayload);
    const { data: classData, error: dbError } = await adminSupabase
        .from('class_groups')
        .insert(insertPayload)
        .select()
        .single();
    if (dbError) {
        console.error('[classes] Error creating class:', dbError);
        return res.status(400).json({ error: dbError.message });
    }
    console.log('[classes] Class created successfully:', classData);
    // If classification values are provided, link them to the class
    if (value.classification_value_ids && value.classification_value_ids.length > 0) {
        console.log('[classes] Linking classifications:', value.classification_value_ids);
        // Verify all classification values belong to the school
        const { data: values, error: valuesError } = await adminSupabase
            .from('classification_values')
            .select(`
        id,
        classification_type:classification_types!inner(id, school_id)
      `)
            .in('id', value.classification_value_ids);
        if (valuesError) {
            console.error('[classes] Error verifying classification values:', valuesError);
            // Rollback: delete the class
            await adminSupabase.from('class_groups').delete().eq('id', classData.id);
            return res.status(400).json({ error: 'Failed to verify classification values' });
        }
        // Verify all values belong to the school
        const invalidValues = (values || []).filter((v) => v.classification_type.school_id !== user.schoolId);
        if (invalidValues.length > 0) {
            console.error('[classes] Invalid classification values:', invalidValues);
            await adminSupabase.from('class_groups').delete().eq('id', classData.id);
            return res.status(403).json({ error: 'Some classification values do not belong to your school' });
        }
        // Insert class classifications
        const classClassifications = value.classification_value_ids.map((valueId) => ({
            class_group_id: classData.id,
            classification_value_id: valueId
        }));
        const { error: linkError } = await adminSupabase
            .from('class_classifications')
            .insert(classClassifications);
        if (linkError) {
            console.error('[classes] Error linking classifications:', linkError);
            // Rollback: delete the class
            await adminSupabase.from('class_groups').delete().eq('id', classData.id);
            return res.status(400).json({ error: 'Failed to link classifications to class' });
        }
    }
    // Fetch the complete class with classifications
    const { data: completeClass, error: fetchError } = await adminSupabase
        .from('class_groups')
        .select(`
      *,
      classifications:class_classifications(
        classification_value:classification_values(
          id,
          value,
          classification_type:classification_types(id, name)
        )
      )
    `)
        .eq('id', classData.id)
        .single();
    if (fetchError) {
        console.error('[classes] Error fetching class with classifications:', fetchError);
        return res.status(201).json({ class: classData });
    }
    const classWithClassifications = {
        ...completeClass,
        classifications: (completeClass.classifications || []).map((cc) => ({
            type: cc.classification_value.classification_type.name,
            value: cc.classification_value.value,
            type_id: cc.classification_value.classification_type.id,
            value_id: cc.classification_value.id
        }))
    };
    console.log('[classes] Class created with classifications:', classWithClassifications);
    return res.status(201).json({ class: classWithClassifications });
});
// Update a class
router.put('/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS for admin operations
    // Verify the class belongs to the school
    const { data: existingClass, error: checkError } = await adminSupabase
        .from('class_groups')
        .select('id, school_id')
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .single();
    if (checkError || !existingClass) {
        return res.status(404).json({ error: 'Class not found or access denied' });
    }
    // Update the class basic info
    const { data, error: dbError } = await adminSupabase
        .from('class_groups')
        .update({
        name: value.name,
        description: value.description || null
    })
        .eq('id', req.params.id)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    // Handle classification updates
    if (value.classification_value_ids !== undefined) {
        // Delete existing classifications
        const { error: deleteError } = await adminSupabase
            .from('class_classifications')
            .delete()
            .eq('class_group_id', req.params.id);
        if (deleteError) {
            console.error('[classes] Error deleting existing classifications:', deleteError);
            // Continue anyway - we'll try to add new ones
        }
        // Add new classifications if provided
        if (value.classification_value_ids && value.classification_value_ids.length > 0) {
            // Verify all classification values belong to the school
            const { data: values, error: valuesError } = await adminSupabase
                .from('classification_values')
                .select(`
          id,
          classification_type:classification_types!inner(id, school_id)
        `)
                .in('id', value.classification_value_ids);
            if (valuesError) {
                console.error('[classes] Error verifying classification values:', valuesError);
                return res.status(400).json({ error: 'Failed to verify classification values' });
            }
            // Verify all values belong to the school
            const invalidValues = (values || []).filter((v) => v.classification_type.school_id !== user.schoolId);
            if (invalidValues.length > 0) {
                console.error('[classes] Invalid classification values:', invalidValues);
                return res.status(403).json({ error: 'Some classification values do not belong to your school' });
            }
            // Insert new class classifications
            const classClassifications = value.classification_value_ids.map((valueId) => ({
                class_group_id: req.params.id,
                classification_value_id: valueId
            }));
            const { error: linkError } = await adminSupabase
                .from('class_classifications')
                .insert(classClassifications);
            if (linkError) {
                console.error('[classes] Error linking classifications:', linkError);
                return res.status(400).json({ error: 'Failed to update classifications' });
            }
        }
    }
    // Fetch the complete class with classifications
    const { data: completeClass, error: fetchError } = await adminSupabase
        .from('class_groups')
        .select(`
      *,
      classifications:class_classifications(
        classification_value:classification_values(
          id,
          value,
          classification_type:classification_types(id, name)
        )
      )
    `)
        .eq('id', req.params.id)
        .single();
    if (fetchError) {
        console.error('[classes] Error fetching updated class:', fetchError);
        return res.json({ class: data });
    }
    const classWithClassifications = {
        ...completeClass,
        classifications: (completeClass.classifications || []).map((cc) => ({
            type: cc.classification_value.classification_type.name,
            value: cc.classification_value.value,
            type_id: cc.classification_value.classification_type.id,
            value_id: cc.classification_value.id
        }))
    };
    return res.json({ class: classWithClassifications });
});
// Delete a class
router.delete('/:id', requireRoles(['principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Verify the class belongs to the school
    const { data: existingClass, error: checkError } = await supabase
        .from('class_groups')
        .select('id, school_id')
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .single();
    if (checkError || !existingClass) {
        return res.status(404).json({ error: 'Class not found or access denied' });
    }
    const { error: dbError } = await supabase
        .from('class_groups')
        .delete()
        .eq('id', req.params.id);
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.json({ message: 'Class deleted successfully' });
});
// Get sections for a class group
router.get('/:classId/sections', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const classId = req.params.classId;
    // Verify the class belongs to the school
    const { data: classGroup, error: classError } = await supabase
        .from('class_groups')
        .select('id, school_id')
        .eq('id', classId)
        .eq('school_id', user.schoolId)
        .single();
    if (classError || !classGroup) {
        return res.status(404).json({ error: 'Class not found or access denied' });
    }
    // Get sections for the class
    const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('id, name')
        .eq('class_group_id', classId)
        .order('name', { ascending: true });
    if (sectionsError) {
        return res.status(400).json({ error: sectionsError.message });
    }
    return res.json({ sections: sections || [] });
});
// Add a subject to a class
router.post('/:classId/subjects', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { error, value } = Joi.object({
        subject_id: Joi.string().uuid().required()
    }).validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const classId = req.params.classId;
    // Verify the class belongs to the school
    const { data: classGroup, error: classError } = await adminSupabase
        .from('class_groups')
        .select('id, school_id')
        .eq('id', classId)
        .eq('school_id', user.schoolId)
        .single();
    if (classError || !classGroup) {
        return res.status(404).json({ error: 'Class not found or access denied' });
    }
    // Verify the subject belongs to the school
    const { data: subject, error: subjectError } = await adminSupabase
        .from('subjects')
        .select('id, school_id')
        .eq('id', value.subject_id)
        .eq('school_id', user.schoolId)
        .single();
    if (subjectError || !subject) {
        return res.status(404).json({ error: 'Subject not found or access denied' });
    }
    // Check if the relationship already exists
    const { data: existing, error: checkError } = await adminSupabase
        .from('class_subjects')
        .select('id')
        .eq('class_group_id', classId)
        .eq('subject_id', value.subject_id)
        .single();
    if (existing) {
        return res.status(400).json({ error: 'Subject is already assigned to this class' });
    }
    // Add the subject to the class
    const { data: classSubject, error: insertError } = await adminSupabase
        .from('class_subjects')
        .insert({
        class_group_id: classId,
        subject_id: value.subject_id,
        school_id: user.schoolId
    })
        .select(`
      id,
      subject:subjects(id, name, code)
    `)
        .single();
    if (insertError) {
        console.error('[classes] Error adding subject to class:', insertError);
        return res.status(400).json({ error: insertError.message });
    }
    return res.status(201).json({
        class_subject: {
            id: classSubject.id,
            subject: classSubject.subject
        }
    });
});
// Remove a subject from a class
router.delete('/:classId/subjects/:classSubjectId', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const classId = req.params.classId;
    const classSubjectId = req.params.classSubjectId;
    // Verify the class_subject relationship exists and belongs to the school
    const { data: classSubject, error: checkError } = await adminSupabase
        .from('class_subjects')
        .select('id, school_id, class_group_id')
        .eq('id', classSubjectId)
        .eq('class_group_id', classId)
        .eq('school_id', user.schoolId)
        .single();
    if (checkError || !classSubject) {
        return res.status(404).json({ error: 'Class-subject relationship not found or access denied' });
    }
    // Delete the relationship
    const { error: deleteError } = await adminSupabase
        .from('class_subjects')
        .delete()
        .eq('id', classSubjectId);
    if (deleteError) {
        console.error('[classes] Error removing subject from class:', deleteError);
        return res.status(400).json({ error: deleteError.message });
    }
    return res.json({ message: 'Subject removed from class successfully' });
});
export default router;
