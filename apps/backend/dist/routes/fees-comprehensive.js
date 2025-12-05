import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// ============================================
// FEE CATEGORIES
// ============================================
const feeCategorySchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null).optional(),
    is_active: Joi.boolean().default(true),
    display_order: Joi.number().integer().default(0)
});
// Get all fee categories
router.get('/categories', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error } = await supabase
        .from('fee_categories')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ categories: data || [] });
});
// Create fee category (Principal only)
router.post('/categories', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeCategorySchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const payload = { ...value, school_id: user.schoolId };
    const { data, error: dbError } = await supabase
        .from('fee_categories')
        .insert(payload)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.status(201).json({ category: data });
});
// Update fee category (Principal only)
router.put('/categories/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeCategorySchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error: dbError } = await supabase
        .from('fee_categories')
        .update(value)
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    if (!data)
        return res.status(404).json({ error: 'Fee category not found' });
    return res.json({ category: data });
});
// Delete fee category (Principal only)
router.delete('/categories/:id', requireRoles(['principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { error } = await supabase
        .from('fee_categories')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId);
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ success: true });
});
// ============================================
// CLASS FEES
// ============================================
const classFeeSchema = Joi.object({
    class_group_id: Joi.string().uuid().required(),
    name: Joi.string().required(), // Add name field
    fee_category_id: Joi.string().uuid().allow(null).optional(), // Make optional
    amount: Joi.number().min(0).required(),
    fee_cycle: Joi.string().valid('one-time', 'monthly', 'quarterly', 'yearly').default('monthly'),
    due_day: Joi.number().integer().min(1).max(31).optional(),
    due_date: Joi.date().optional(),
    is_active: Joi.boolean().default(true),
    notes: Joi.string().allow('', null).optional()
});
// Get class fees
router.get('/class-fees', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const classGroupId = req.query.class_group_id;
    let query = supabase
        .from('class_fee_defaults')
        .select(`
      *,
      class_groups:class_group_id(id, name),
      fee_categories:fee_category_id(id, name, description)
    `)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (classGroupId) {
        query = query.eq('class_group_id', classGroupId);
    }
    const { data, error } = await query;
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ class_fees: data || [] });
});
// Create class fee (Principal only)
router.post('/class-fees', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classFeeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Create class fee default
        // Remove due_day, due_date, name, and notes from payload as class_fee_defaults doesn't have these columns
        // (name column may not exist in all databases - migration 026 adds it but may not be applied)
        const { due_day, due_date, name, notes, ...feeData } = value;
        const payload = { ...feeData, school_id: user.schoolId };
        const { data: classFee, error: dbError } = await adminSupabase
            .from('class_fee_defaults')
            .insert(payload)
            .select(`
        *,
        class_groups:class_group_id(id, name),
        fee_categories:fee_category_id(id, name, description)
      `)
            .single();
        if (dbError)
            return res.status(400).json({ error: dbError.message });
        // Create initial version (effective from today)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const { error: versionError } = await adminSupabase
            .from('class_fee_versions')
            .insert({
            school_id: user.schoolId,
            class_group_id: value.class_group_id,
            fee_category_id: value.fee_category_id || null,
            version_number: 1,
            amount: value.amount,
            fee_cycle: value.fee_cycle,
            effective_from_date: todayStr,
            effective_to_date: null,
            is_active: true,
            created_by: user.id
        });
        if (versionError) {
            console.error('[create-class-fee] Error creating initial version:', versionError);
            // Don't fail the request, but log the error
        }
        return res.status(201).json({ class_fee: classFee });
    }
    catch (err) {
        console.error('[create-class-fee] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to create class fee' });
    }
});
// Update class fee (Principal only)
router.put('/class-fees/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = classFeeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Remove due_day, due_date, name, and notes from payload as class_fee_defaults doesn't have these columns
    const { due_day, due_date, name, notes, ...updateData } = value;
    const { data, error: dbError } = await adminSupabase
        .from('class_fee_defaults')
        .update(updateData)
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .select(`
      *,
      class_groups:class_group_id(id, name),
      fee_categories:fee_category_id(id, name, description)
    `)
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    if (!data)
        return res.status(404).json({ error: 'Class fee not found' });
    return res.json({ class_fee: data });
});
// Delete class fee (Principal only)
router.delete('/class-fees/:id', requireRoles(['principal']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { error } = await supabase
        .from('class_fee_defaults')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId);
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ success: true });
});
// ============================================
// TRANSPORT ROUTES
// ============================================
const transportRouteSchema = Joi.object({
    route_name: Joi.string().required(),
    bus_number: Joi.string().allow('', null).optional(),
    distance_km: Joi.number().min(0).optional(),
    zone: Joi.string().allow('', null).optional(),
    description: Joi.string().allow('', null).optional(),
    is_active: Joi.boolean().default(true)
});
// Get transport routes
router.get('/transport/routes', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error } = await adminSupabase
        .from('transport_routes')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('route_name', { ascending: true });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ routes: data || [] });
});
// Create transport route
router.post('/transport/routes', requireRoles(['principal']), async (req, res) => {
    const { error, value } = transportRouteSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const payload = { ...value, school_id: user.schoolId };
    const { data, error: dbError } = await adminSupabase
        .from('transport_routes')
        .insert(payload)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.status(201).json({ route: data });
});
// Update transport route
router.put('/transport/routes/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = transportRouteSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error: dbError } = await adminSupabase
        .from('transport_routes')
        .update(value)
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    if (!data)
        return res.status(404).json({ error: 'Transport route not found' });
    return res.json({ route: data });
});
// ============================================
// TRANSPORT FEES
// ============================================
const transportFeeSchema = Joi.object({
    route_id: Joi.string().uuid().required(),
    base_fee: Joi.number().min(0).required(),
    escort_fee: Joi.number().min(0).default(0),
    fuel_surcharge: Joi.number().min(0).default(0),
    fee_cycle: Joi.string().valid('monthly', 'per-trip', 'yearly').default('monthly'),
    due_day: Joi.number().integer().min(1).max(31).optional(),
    is_active: Joi.boolean().default(true),
    notes: Joi.string().allow('', null).optional()
});
// Get transport fees
router.get('/transport/fees', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use transport_fees table (has route_id) instead of transport_fee_defaults (has route_name)
    const { data, error } = await adminSupabase
        .from('transport_fees')
        .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone)
    `)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ transport_fees: data || [] });
});
// Create transport fee
router.post('/transport/fees', requireRoles(['principal']), async (req, res) => {
    const { error, value } = transportFeeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Get route to verify it belongs to the school
    const { data: route, error: routeError } = await adminSupabase
        .from('transport_routes')
        .select('school_id')
        .eq('id', value.route_id)
        .single();
    if (routeError || !route || route.school_id !== user.schoolId) {
        return res.status(400).json({ error: 'Invalid route' });
    }
    // Use transport_fees table (has route_id) instead of transport_fee_defaults
    const payload = { ...value, school_id: user.schoolId };
    const { data, error: dbError } = await adminSupabase
        .from('transport_fees')
        .insert(payload)
        .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone)
    `)
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.status(201).json({ transport_fee: data });
});
// Update transport fee
router.put('/transport/fees/:id', requireRoles(['principal']), async (req, res) => {
    const { error, value } = transportFeeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use transport_fees table (has route_id) instead of transport_fee_defaults
    const { data, error: dbError } = await adminSupabase
        .from('transport_fees')
        .update(value)
        .eq('id', req.params.id)
        .eq('school_id', user.schoolId)
        .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone)
    `)
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    if (!data)
        return res.status(404).json({ error: 'Transport fee not found' });
    return res.json({ transport_fee: data });
});
// ============================================
// CUSTOM FEES (Class-specific custom fees)
// ============================================
const customFeeSchema = Joi.object({
    class_group_id: Joi.string().uuid().allow(null, '').optional(), // null or empty = all classes
    name: Joi.string().required(),
    amount: Joi.number().min(0).required(),
    fee_cycle: Joi.string().valid('one-time', 'monthly', 'quarterly', 'yearly').default('monthly'),
    is_active: Joi.boolean().default(true)
});
// Get custom fees
router.get('/custom-fees', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const classGroupId = req.query.class_group_id;
    // First, get all custom fee category IDs for this school
    const { data: customCategories, error: catError } = await supabase
        .from('fee_categories')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('fee_type', 'custom')
        .eq('is_active', true);
    if (catError)
        return res.status(400).json({ error: catError.message });
    const customCategoryIds = (customCategories || []).map((cat) => cat.id);
    if (customCategoryIds.length === 0) {
        return res.json({ custom_fees: [] });
    }
    // Now get optional_fee_definitions filtered by custom category IDs
    let query = supabase
        .from('optional_fee_definitions')
        .select(`
      *,
      class_groups:class_group_id(id, name),
      fee_categories:fee_category_id(id, name, description, fee_type)
    `)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .in('fee_category_id', customCategoryIds)
        .order('created_at', { ascending: false });
    if (classGroupId) {
        // Get custom fees for this class OR for all classes (where class_group_id is null)
        query = query.or(`class_group_id.eq.${classGroupId},class_group_id.is.null`);
    }
    const { data, error } = await query;
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ custom_fees: data || [] });
});
// Create custom fee (Principal only)
router.post('/custom-fees', requireRoles(['principal']), async (req, res) => {
    const { error, value } = customFeeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const today = new Date().toISOString().split('T')[0];
        // Create a fee_category for this custom fee (to store the name)
        // This allows us to store the custom fee name properly
        const { data: feeCategory, error: categoryError } = await adminSupabase
            .from('fee_categories')
            .insert({
            school_id: user.schoolId,
            name: value.name,
            fee_type: 'custom',
            is_active: true
        })
            .select()
            .single();
        if (categoryError) {
            // If category creation fails, try to find existing one with same name
            const { data: existingCategory } = await adminSupabase
                .from('fee_categories')
                .select('id')
                .eq('school_id', user.schoolId)
                .eq('name', value.name)
                .eq('fee_type', 'custom')
                .eq('is_active', true)
                .maybeSingle();
            if (!existingCategory) {
                return res.status(400).json({ error: categoryError.message || 'Failed to create fee category' });
            }
            // Use existing category
            const feeCategoryId = existingCategory.id;
            // Create custom fee in optional_fee_definitions
            const payload = {
                school_id: user.schoolId,
                class_group_id: value.class_group_id || null, // null = applies to all classes
                fee_category_id: feeCategoryId, // Link to the custom fee category
                amount: value.amount,
                fee_cycle: value.fee_cycle,
                effective_from: today,
                effective_to: null,
                is_active: value.is_active
            };
            const { data: customFee, error: dbError } = await adminSupabase
                .from('optional_fee_definitions')
                .insert(payload)
                .select(`
          *,
          class_groups:class_group_id(id, name),
          fee_categories:fee_category_id(id, name, description, fee_type)
        `)
                .single();
            if (dbError)
                return res.status(400).json({ error: dbError.message });
            return res.status(201).json({ custom_fee: customFee });
        }
        // Create custom fee in optional_fee_definitions with the new category
        const payload = {
            school_id: user.schoolId,
            class_group_id: value.class_group_id || null, // null = applies to all classes
            fee_category_id: feeCategory.id, // Link to the custom fee category
            amount: value.amount,
            fee_cycle: value.fee_cycle,
            effective_from: today,
            effective_to: null,
            is_active: value.is_active
        };
        const { data: customFee, error: dbError } = await adminSupabase
            .from('optional_fee_definitions')
            .insert(payload)
            .select(`
        *,
        class_groups:class_group_id(id, name),
        fee_categories:fee_category_id(id, name, description, fee_type)
      `)
            .single();
        if (dbError)
            return res.status(400).json({ error: dbError.message });
        return res.status(201).json({ custom_fee: customFee });
    }
    catch (err) {
        console.error('[create-custom-fee] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to create custom fee' });
    }
});
// Delete custom fee (Principal only)
router.delete('/custom-fees/:id', requireRoles(['principal']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // First get the custom fee to find its category
        const { data: customFee } = await adminSupabase
            .from('optional_fee_definitions')
            .select('fee_category_id')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .single();
        if (customFee && customFee.fee_category_id) {
            // Verify it's a custom fee category
            const { data: category } = await adminSupabase
                .from('fee_categories')
                .select('fee_type')
                .eq('id', customFee.fee_category_id)
                .eq('fee_type', 'custom')
                .single();
            if (category) {
                const { error } = await adminSupabase
                    .from('optional_fee_definitions')
                    .update({ is_active: false })
                    .eq('id', req.params.id)
                    .eq('school_id', user.schoolId);
                if (error)
                    return res.status(400).json({ error: error.message });
                return res.json({ success: true });
            }
        }
        return res.status(404).json({ error: 'Custom fee not found' });
    }
    catch (err) {
        console.error('[delete-custom-fee] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to delete custom fee' });
    }
});
// ============================================
// STUDENT TRANSPORT ASSIGNMENT
// ============================================
const studentTransportSchema = Joi.object({
    student_id: Joi.string().uuid().required(),
    route_id: Joi.string().uuid().required(),
    stop_name: Joi.string().allow('', null).optional(),
    start_date: Joi.date().default(() => new Date()),
    end_date: Joi.date().allow(null).optional(),
    is_active: Joi.boolean().default(true)
});
// Assign student to transport route
router.post('/transport/assign', requireRoles(['principal']), async (req, res) => {
    const { error, value } = studentTransportSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Verify student and route belong to same school
    const { data: student } = await adminSupabase
        .from('students')
        .select('school_id')
        .eq('id', value.student_id)
        .single();
    const { data: route } = await adminSupabase
        .from('transport_routes')
        .select('school_id')
        .eq('id', value.route_id)
        .single();
    if (!student || !route || student.school_id !== user.schoolId || route.school_id !== user.schoolId) {
        return res.status(400).json({ error: 'Invalid student or route' });
    }
    // Deactivate existing assignments
    await adminSupabase
        .from('student_transport')
        .update({ is_active: false, end_date: new Date() })
        .eq('student_id', value.student_id)
        .eq('is_active', true);
    const payload = {
        student_id: value.student_id,
        route_id: value.route_id,
        stop_name: value.stop_name,
        start_date: value.start_date,
        end_date: value.end_date,
        is_active: value.is_active,
        school_id: user.schoolId
    };
    const { data, error: dbError } = await adminSupabase
        .from('student_transport')
        .insert(payload)
        .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number),
      students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name))
    `)
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.status(201).json({ assignment: data });
});
// Get student transport assignments
router.get('/transport/assignments', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const studentId = req.query.student_id;
    let query = supabase
        .from('student_transport')
        .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone),
      students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name))
    `)
        .eq('school_id', user.schoolId)
        .eq('is_active', true);
    if (studentId) {
        query = query.eq('student_id', studentId);
    }
    const { data, error } = await query;
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ assignments: data || [] });
});
// ============================================
// STUDENT CUSTOM FEES - REMOVED
// ============================================
// ============================================
// FEE BILLS - REMOVED
// ============================================
// ============================================
// FEE PAYMENTS - REMOVED
// ============================================
// ============================================
// STUDENT FEE CYCLES
// ============================================
const studentFeeCycleSchema = Joi.object({
    student_id: Joi.string().uuid().required(),
    fee_cycle: Joi.string().valid('monthly', 'quarterly', 'yearly', 'one-time').required(),
    effective_from: Joi.date().required(),
    effective_to: Joi.date().allow(null).optional(),
    fee_category_id: Joi.string().uuid().allow(null).optional()
});
// Set student fee cycle
router.post('/student-cycles', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { error, value } = studentFeeCycleSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Verify student belongs to school
    const { data: student, error: studentError } = await adminSupabase
        .from('students')
        .select('id, school_id')
        .eq('id', value.student_id)
        .eq('school_id', user.schoolId)
        .single();
    if (studentError || !student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    // Deactivate existing cycles for this student/category
    await adminSupabase
        .from('student_fee_cycles')
        .update({ is_active: false })
        .eq('student_id', value.student_id)
        .eq('school_id', user.schoolId)
        .eq('fee_category_id', value.fee_category_id || null);
    // Create new cycle
    const payload = {
        ...value,
        school_id: user.schoolId,
        is_active: true
    };
    const { data, error: dbError } = await adminSupabase
        .from('student_fee_cycles')
        .insert(payload)
        .select()
        .single();
    if (dbError)
        return res.status(400).json({ error: dbError.message });
    return res.status(201).json({ cycle: data });
});
// Get student fee cycles
router.get('/student-cycles/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { data, error } = await supabase
        .from('student_fee_cycles')
        .select('*')
        .eq('student_id', req.params.studentId)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('effective_from', { ascending: false });
    if (error)
        return res.status(400).json({ error: error.message });
    return res.json({ cycles: data || [] });
});
// ============================================
// FEE BILL PERIODS
// ============================================
// Generate fee schedule for student
router.post('/generate-schedule', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { student_id, academic_year } = req.body;
    if (!student_id || !academic_year) {
        return res.status(400).json({ error: 'student_id and academic_year are required' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { generateStudentFeeSchedule } = await import('../utils/feeBilling.js');
        if (!user.schoolId) {
            return res.status(500).json({ error: 'School ID not found' });
        }
        const periods = await generateStudentFeeSchedule(student_id, user.schoolId, academic_year, adminSupabase);
        return res.json({
            message: 'Fee schedule generated successfully',
            periods: periods.length
        });
    }
    catch (err) {
        console.error('[generate-schedule] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to generate schedule' });
    }
});
// Get pending periods for student
router.get('/periods/pending/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { getPendingPeriods } = await import('../utils/feeBilling.js');
        const periods = await getPendingPeriods(req.params.studentId, adminSupabase);
        return res.json({ periods });
    }
    catch (err) {
        console.error('[pending-periods] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get pending periods' });
    }
});
// Get overdue periods for student
router.get('/periods/overdue/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { getOverduePeriods } = await import('../utils/feeBilling.js');
        const periods = await getOverduePeriods(req.params.studentId, adminSupabase);
        return res.json({ periods });
    }
    catch (err) {
        console.error('[overdue-periods] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get overdue periods' });
    }
});
// Get total dues for student
router.get('/dues/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { getStudentTotalDues } = await import('../utils/feeBilling.js');
        const dues = await getStudentTotalDues(req.params.studentId, adminSupabase);
        return res.json({ dues });
    }
    catch (err) {
        console.error('[student-dues] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get student dues' });
    }
});
// ============================================
// FEE HIKE / VERSIONING ENDPOINTS
// ============================================
const feeHikeSchema = Joi.object({
    new_amount: Joi.number().min(0).required(),
    effective_from_date: Joi.date().required(),
    notes: Joi.string().allow('', null).optional()
});
// Hike Class Fee (Create New Version)
router.post('/class-fees/:id/hike', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeHikeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Get the class fee default to get class_group_id, fee_category_id, fee_cycle
        const { data: classFee, error: feeError } = await adminSupabase
            .from('class_fee_defaults')
            .select('*')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .single();
        if (feeError || !classFee) {
            return res.status(404).json({ error: 'Class fee not found' });
        }
        // Import fee versioning utilities
        const { hikeClassFee } = await import('../utils/feeVersioning.js');
        const effectiveFromDate = new Date(value.effective_from_date);
        const versionId = await hikeClassFee(user.schoolId, classFee.class_group_id || null, classFee.fee_category_id || null, classFee.fee_cycle, value.new_amount, effectiveFromDate, user.id, adminSupabase);
        // Update the class_fee_defaults amount to reflect current version
        await adminSupabase
            .from('class_fee_defaults')
            .update({ amount: value.new_amount, updated_at: new Date().toISOString() })
            .eq('id', req.params.id);
        return res.json({
            success: true,
            message: 'Fee hike applied successfully',
            version_id: versionId,
            new_amount: value.new_amount,
            effective_from_date: effectiveFromDate.toISOString().split('T')[0]
        });
    }
    catch (err) {
        console.error('[fee-hike] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to hike fee' });
    }
});
// Hike Transport Fee
router.post('/transport/fees/:id/hike', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeHikeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Get transport fee (use transport_fees table which has route_id)
        const { data: transportFee, error: feeError } = await adminSupabase
            .from('transport_fees')
            .select('*, transport_routes:route_id(route_name)')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .single();
        if (feeError || !transportFee) {
            return res.status(404).json({ error: 'Transport fee not found' });
        }
        // Get class_group_id from route or use default
        const { data: route } = await adminSupabase
            .from('transport_routes')
            .select('class_group_id')
            .eq('id', transportFee.route_id)
            .single();
        const classGroupId = route?.class_group_id || transportFee.class_group_id || null;
        const routeName = transportFee.transport_routes?.route_name || null;
        const totalAmount = parseFloat(transportFee.base_fee || 0) +
            parseFloat(transportFee.escort_fee || 0) +
            parseFloat(transportFee.fuel_surcharge || 0);
        // Import fee versioning utilities
        const { hikeTransportFee } = await import('../utils/feeVersioning.js');
        const effectiveFromDate = new Date(value.effective_from_date);
        const versionId = await hikeTransportFee(user.schoolId, classGroupId, routeName, transportFee.fee_cycle, value.new_amount, effectiveFromDate, user.id, adminSupabase);
        // Update transport_fees
        await adminSupabase
            .from('transport_fees')
            .update({
            base_fee: value.new_amount,
            updated_at: new Date().toISOString()
        })
            .eq('id', req.params.id);
        return res.json({
            success: true,
            message: 'Transport fee hike applied successfully',
            version_id: versionId,
            new_amount: value.new_amount,
            effective_from_date: effectiveFromDate.toISOString().split('T')[0]
        });
    }
    catch (err) {
        console.error('[transport-fee-hike] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to hike transport fee' });
    }
});
// Hike Custom Fee (Create New Version)
router.post('/custom-fees/:id/hike', requireRoles(['principal']), async (req, res) => {
    const { error, value } = feeHikeSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // First, get all custom fee category IDs
        const { data: customCategories, error: catError } = await adminSupabase
            .from('fee_categories')
            .select('id')
            .eq('fee_type', 'custom')
            .eq('school_id', user.schoolId);
        if (catError) {
            return res.status(500).json({ error: `Failed to fetch custom fee categories: ${catError.message}` });
        }
        const customCategoryIds = (customCategories || []).map((cat) => cat.id);
        if (customCategoryIds.length === 0) {
            return res.status(404).json({ error: 'No custom fee categories found' });
        }
        // Get the custom fee definition to get class_group_id, fee_category_id, fee_cycle
        const { data: customFee, error: feeError } = await adminSupabase
            .from('optional_fee_definitions')
            .select('*')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .in('fee_category_id', customCategoryIds)
            .single();
        if (feeError || !customFee) {
            return res.status(404).json({ error: 'Custom fee not found' });
        }
        // Import fee versioning utilities
        const { hikeOptionalFee } = await import('../utils/feeVersioning.js');
        const effectiveFromDate = new Date(value.effective_from_date);
        const versionId = await hikeOptionalFee(user.schoolId, customFee.class_group_id || null, customFee.fee_category_id, customFee.fee_cycle, value.new_amount, effectiveFromDate, user.id, adminSupabase);
        // Update the optional_fee_definitions amount to reflect current version
        await adminSupabase
            .from('optional_fee_definitions')
            .update({ amount: value.new_amount, updated_at: new Date().toISOString() })
            .eq('id', req.params.id);
        return res.json({
            success: true,
            message: 'Custom fee hike applied successfully',
            version_id: versionId,
            new_amount: value.new_amount,
            effective_from_date: effectiveFromDate.toISOString().split('T')[0]
        });
    }
    catch (err) {
        console.error('[custom-fee-hike] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to hike custom fee' });
    }
});
// Get custom fee versions
router.get('/custom-fees/:id/versions', requireRoles(['principal', 'clerk']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // First, get all custom fee category IDs
        const { data: customCategories, error: catError } = await adminSupabase
            .from('fee_categories')
            .select('id')
            .eq('fee_type', 'custom')
            .eq('school_id', user.schoolId);
        if (catError) {
            return res.status(500).json({ error: `Failed to fetch custom fee categories: ${catError.message}` });
        }
        const customCategoryIds = (customCategories || []).map((cat) => cat.id);
        if (customCategoryIds.length === 0) {
            return res.status(404).json({ error: 'No custom fee categories found' });
        }
        // Get the custom fee definition
        const { data: customFee, error: feeError } = await adminSupabase
            .from('optional_fee_definitions')
            .select('class_group_id, fee_category_id, fee_cycle')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .in('fee_category_id', customCategoryIds)
            .single();
        if (feeError || !customFee) {
            return res.status(404).json({ error: 'Custom fee not found' });
        }
        // Get all versions for this custom fee
        let versionsQuery = adminSupabase
            .from('optional_fee_versions')
            .select('*')
            .eq('fee_category_id', customFee.fee_category_id)
            .eq('fee_cycle', customFee.fee_cycle)
            .eq('school_id', user.schoolId)
            .order('version_number', { ascending: false });
        // Handle class_group_id (can be null)
        if (customFee.class_group_id) {
            versionsQuery = versionsQuery.eq('class_group_id', customFee.class_group_id);
        }
        else {
            versionsQuery = versionsQuery.is('class_group_id', null);
        }
        const { data: versions, error: versionsError } = await versionsQuery;
        if (versionsError) {
            return res.status(400).json({ error: versionsError.message });
        }
        return res.json({ versions: versions || [] });
    }
    catch (err) {
        console.error('[custom-fee-versions] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get custom fee versions' });
    }
});
// Hike Optional Fee - REMOVED (optional fees removed)
// Get Class Fee Version History
router.get('/class-fees/:id/versions', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Get class fee default to get identifiers
        const { data: classFee, error: feeError } = await adminSupabase
            .from('class_fee_defaults')
            .select('class_group_id, fee_category_id, fee_cycle')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .single();
        if (feeError || !classFee) {
            return res.status(404).json({ error: 'Class fee not found' });
        }
        // Get all versions
        const { data: versions, error: versionsError } = await adminSupabase
            .from('class_fee_versions')
            .select('*')
            .eq('class_group_id', classFee.class_group_id)
            .eq('fee_category_id', classFee.fee_category_id)
            .eq('fee_cycle', classFee.fee_cycle)
            .eq('school_id', user.schoolId)
            .order('version_number', { ascending: false });
        if (versionsError) {
            throw new Error(versionsError.message);
        }
        return res.json({ versions: versions || [] });
    }
    catch (err) {
        console.error('[fee-versions] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get fee versions' });
    }
});
// Get Transport Fee Version History
router.get('/transport/fees/:id/versions', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Get transport fee (use transport_fees table which has route_id)
        const { data: transportFee, error: feeError } = await adminSupabase
            .from('transport_fees')
            .select('route_id, fee_cycle, transport_routes:route_id(route_name, class_group_id)')
            .eq('id', req.params.id)
            .eq('school_id', user.schoolId)
            .single();
        if (feeError || !transportFee) {
            return res.status(404).json({ error: 'Transport fee not found' });
        }
        // Handle transport_routes which could be an object or array
        const transportRoute = Array.isArray(transportFee.transport_routes)
            ? transportFee.transport_routes[0]
            : transportFee.transport_routes;
        const routeName = transportRoute?.route_name || null;
        const classGroupId = transportRoute?.class_group_id || null;
        // Get all versions
        let query = adminSupabase
            .from('transport_fee_versions')
            .select('*')
            .eq('school_id', user.schoolId)
            .eq('fee_cycle', transportFee.fee_cycle)
            .order('version_number', { ascending: false });
        if (classGroupId) {
            query = query.eq('class_group_id', classGroupId);
        }
        if (routeName) {
            query = query.eq('route_name', routeName);
        }
        else {
            query = query.is('route_name', null);
        }
        const { data: versions, error: versionsError } = await query;
        if (versionsError) {
            throw new Error(versionsError.message);
        }
        return res.json({ versions: versions || [] });
    }
    catch (err) {
        console.error('[transport-versions] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get transport fee versions' });
    }
});
// Get Optional Fee Version History - REMOVED (optional fees removed)
export default router;
