import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
// ============================================
// SCHEMAS
// ============================================
const feeOverrideSchema = Joi.object({
    student_id: Joi.string().uuid().required(),
    fee_category_id: Joi.string().uuid().allow(null).optional(), // null = applies to all fees
    discount_amount: Joi.number().min(0).default(0),
    custom_fee_amount: Joi.number().min(0).allow(null).optional(),
    is_full_free: Joi.boolean().default(false),
    effective_from: Joi.date().required(),
    effective_to: Joi.date().allow(null).optional(),
    notes: Joi.string().allow('', null).optional()
});
// ============================================
// CREATE FEE OVERRIDE
// ============================================
router.post('/', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeOverrideSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Verify student belongs to school
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, school_id')
            .eq('id', value.student_id)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // Verify fee category if provided
        if (value.fee_category_id) {
            const { data: category, error: catError } = await supabase
                .from('fee_categories')
                .select('id')
                .eq('id', value.fee_category_id)
                .eq('school_id', user.schoolId)
                .single();
            if (catError || !category) {
                return res.status(404).json({ error: 'Fee category not found' });
            }
        }
        // Deactivate existing overrides that overlap
        if (value.effective_to) {
            await supabase
                .from('student_fee_overrides')
                .update({ is_active: false })
                .eq('student_id', value.student_id)
                .eq('fee_category_id', value.fee_category_id || null)
                .eq('is_active', true)
                .lte('effective_from', value.effective_to)
                .or(`effective_to.is.null,effective_to.gte.${value.effective_from}`);
        }
        // Create new override
        const payload = {
            ...value,
            school_id: user.schoolId,
            applied_by: user.id
        };
        const { data, error: dbError } = await supabase
            .from('student_fee_overrides')
            .insert(payload)
            .select(`
        *,
        students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name)),
        fee_categories:fee_category_id(id, name)
      `)
            .single();
        if (dbError)
            return res.status(400).json({ error: dbError.message });
        return res.status(201).json({ override: data });
    }
    catch (err) {
        console.error('[create-fee-override] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to create fee override' });
    }
});
// ============================================
// GET STUDENT FEE OVERRIDES
// ============================================
router.get('/student/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { studentId } = req.params;
    const { date } = req.query;
    try {
        // Verify student belongs to school
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, school_id')
            .eq('id', studentId)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        let query = supabase
            .from('student_fee_overrides')
            .select(`
        *,
        fee_categories:fee_category_id(id, name, fee_type)
      `)
            .eq('student_id', studentId)
            .eq('school_id', user.schoolId)
            .eq('is_active', true)
            .order('effective_from', { ascending: false });
        // Filter by date if provided
        if (date) {
            const dateStr = new Date(date).toISOString().split('T')[0];
            query = query
                .lte('effective_from', dateStr)
                .or(`effective_to.is.null,effective_to.gte.${dateStr}`);
        }
        const { data, error } = await query;
        if (error)
            return res.status(400).json({ error: error.message });
        return res.json({ overrides: data || [] });
    }
    catch (err) {
        console.error('[get-fee-overrides] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get fee overrides' });
    }
});
// ============================================
// UPDATE FEE OVERRIDE
// ============================================
router.put('/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeOverrideSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { data, error: dbError } = await supabase
            .from('student_fee_overrides')
            .update({
            ...value,
            updated_at: new Date().toISOString()
        })
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .select(`
        *,
        students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name)),
        fee_categories:fee_category_id(id, name)
      `)
            .single();
        if (dbError)
            return res.status(400).json({ error: dbError.message });
        if (!data)
            return res.status(404).json({ error: 'Fee override not found' });
        return res.json({ override: data });
    }
    catch (err) {
        console.error('[update-fee-override] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to update fee override' });
    }
});
// ============================================
// DEACTIVATE FEE OVERRIDE
// ============================================
router.delete('/:id', requireRoles(['principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { data, error: dbError } = await supabase
            .from('student_fee_overrides')
            .update({
            is_active: false,
            effective_to: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        })
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .select()
            .single();
        if (dbError)
            return res.status(400).json({ error: dbError.message });
        if (!data)
            return res.status(404).json({ error: 'Fee override not found' });
        return res.json({ success: true });
    }
    catch (err) {
        console.error('[delete-fee-override] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to deactivate fee override' });
    }
});
export default router;
