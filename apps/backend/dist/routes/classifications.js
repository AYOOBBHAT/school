import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { cacheFetch, invalidateCache } from '../utils/cache.js';
const router = Router();
// Schema for classification type
const classificationTypeSchema = Joi.object({
    name: Joi.string().required(),
    display_order: Joi.number().integer().default(0)
});
// Schema for classification value
const classificationValueSchema = Joi.object({
    classification_type_id: Joi.string().uuid().required(),
    value: Joi.string().required(),
    display_order: Joi.number().integer().default(0)
});
// Get all classification types for the school (CACHED)
router.get('/types', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const cacheKey = `school:${user.schoolId}:classifications`;
    try {
        const types = await cacheFetch(cacheKey, async () => {
            const { data, error } = await adminSupabase
                .from('classification_types')
                .select('id, name, display_order, school_id, created_at')
                .eq('school_id', user.schoolId)
                .order('display_order', { ascending: true });
            if (error)
                throw error;
            return data || [];
        });
        return res.json({ types });
    }
    catch (error) {
        return res.status(400).json({ error: error.message || 'Failed to fetch classification types' });
    }
});
// Create a classification type
router.post('/types', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classificationTypeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    const insertPayload = {
        name: value.name,
        display_order: value.display_order || 0,
        school_id: user.schoolId
    };
    console.log('[classifications] Creating type:', insertPayload);
    const { data, error: dbError } = await adminSupabase
        .from('classification_types')
        .insert(insertPayload)
        .select()
        .single();
    if (dbError) {
        if (dbError.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Classification type with this name already exists' });
        }
        console.error('[classifications] Error creating type:', dbError);
        return res.status(400).json({ error: dbError.message });
    }
    // Invalidate cache after creating a classification type
    await invalidateCache(`school:${user.schoolId}:classifications`);
    return res.status(201).json({ type: data });
});
// Update a classification type
router.put('/types/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classificationTypeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    // Verify the type belongs to the school
    const { data: existingType, error: checkError } = await adminSupabase
        .from('classification_types')
        .select('id, school_id')
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .single();
    if (checkError || !existingType) {
        return res.status(404).json({ error: 'Classification type not found or access denied' });
    }
    const { data, error: dbError } = await adminSupabase
        .from('classification_types')
        .update({
        name: value.name,
        display_order: value.display_order || 0
    })
        .eq('id', req.params.id)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    // Invalidate cache after updating a classification type
    await invalidateCache(`school:${user.schoolId}:classifications`);
    return res.json({ type: data });
});
// Delete a classification type
router.delete('/types/:id', requireRoles(['principal']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    // Verify the type belongs to the school
    const { data: existingType, error: checkError } = await adminSupabase
        .from('classification_types')
        .select('id, school_id')
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .single();
    if (checkError || !existingType) {
        return res.status(404).json({ error: 'Classification type not found or access denied' });
    }
    const { error: dbError } = await adminSupabase
        .from('classification_types')
        .delete()
        .eq('id', req.params.id);
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    // Invalidate cache after deleting a classification type
    await invalidateCache(`school:${user.schoolId}:classifications`);
    return res.json({ message: 'Classification type deleted successfully' });
});
// Get all values for a classification type
router.get('/types/:typeId/values', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    // Verify the type belongs to the school
    const { data: type, error: typeError } = await adminSupabase
        .from('classification_types')
        .select('id')
        .eq('id', req.params.typeId)
        .eq('school_id', user.schoolId)
        .single();
    if (typeError || !type) {
        return res.status(404).json({ error: 'Classification type not found' });
    }
    const { data, error } = await adminSupabase
        .from('classification_values')
        .select('id, value, display_order, classification_type_id, created_at')
        .eq('classification_type_id', req.params.typeId)
        .order('display_order', { ascending: true });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ values: data || [] });
});
// Create a classification value
router.post('/values', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classificationValueSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    // Verify the type belongs to the school
    const { data: type, error: typeError } = await adminSupabase
        .from('classification_types')
        .select('id')
        .eq('id', value.classification_type_id)
        .eq('school_id', user.schoolId)
        .single();
    if (typeError || !type) {
        return res.status(404).json({ error: 'Classification type not found' });
    }
    const insertPayload = {
        classification_type_id: value.classification_type_id,
        value: value.value,
        display_order: value.display_order || 0
    };
    console.log('[classifications] Creating value:', insertPayload);
    const { data, error: dbError } = await adminSupabase
        .from('classification_values')
        .insert(insertPayload)
        .select()
        .single();
    if (dbError) {
        if (dbError.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Classification value already exists for this type' });
        }
        console.error('[classifications] Error creating value:', dbError);
        return res.status(400).json({ error: dbError.message });
    }
    // Invalidate cache after creating a classification value
    await invalidateCache(`school:${user.schoolId}:classifications`);
    return res.status(201).json({ value: data });
});
// Update a classification value
router.put('/values/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classificationValueSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    // Verify the value's type belongs to the school
    const { data: existingValue, error: valueError } = await adminSupabase
        .from('classification_values')
        .select(`
      *,
      classification_type:classification_types!inner(id, school_id)
    `)
        .eq('id', req.params.id)
        .single();
    if (valueError || !existingValue) {
        return res.status(404).json({ error: 'Classification value not found' });
    }
    const type = existingValue.classification_type;
    if (type.school_id !== user.schoolId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const { data, error: dbError } = await adminSupabase
        .from('classification_values')
        .update({
        value: value.value,
        display_order: value.display_order || 0
    })
        .eq('id', req.params.id)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    // Invalidate cache after updating a classification value
    await invalidateCache(`school:${user.schoolId}:classifications`);
    return res.json({ value: data });
});
// Delete a classification value
router.delete('/values/:id', requireRoles(['principal']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use service role key to bypass RLS
    // Verify the value's type belongs to the school
    const { data: existingValue, error: valueError } = await adminSupabase
        .from('classification_values')
        .select(`
      *,
      classification_type:classification_types!inner(id, school_id)
    `)
        .eq('id', req.params.id)
        .single();
    if (valueError || !existingValue) {
        return res.status(404).json({ error: 'Classification value not found' });
    }
    const type = existingValue.classification_type;
    if (type.school_id !== user.schoolId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const { error: dbError } = await adminSupabase
        .from('classification_values')
        .delete()
        .eq('id', req.params.id);
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    // Invalidate cache after deleting a classification value
    await invalidateCache(`school:${user.schoolId}:classifications`);
    return res.json({ message: 'Classification value deleted successfully' });
});
export default router;
