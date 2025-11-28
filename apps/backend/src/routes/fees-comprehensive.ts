import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

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
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('fee_categories')
    .select('*')
    .eq('school_id', user.schoolId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ categories: data || [] });
});

// Create fee category (Principal only)
router.post('/categories', requireRoles(['principal']), async (req, res) => {
  const { error, value } = feeCategorySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const payload = { ...value, school_id: user.schoolId };
  const { data, error: dbError } = await supabase
    .from('fee_categories')
    .insert(payload)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ category: data });
});

// Update fee category (Principal only)
router.put('/categories/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = feeCategorySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('fee_categories')
    .update(value)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Fee category not found' });
  return res.json({ category: data });
});

// Delete fee category (Principal only)
router.delete('/categories/:id', requireRoles(['principal']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { error } = await supabase
    .from('fee_categories')
    .delete()
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId);

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ success: true });
});

// ============================================
// CLASS FEES
// ============================================

const classFeeSchema = Joi.object({
  class_group_id: Joi.string().uuid().required(),
  fee_category_id: Joi.string().uuid().required(),
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
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const classGroupId = req.query.class_group_id as string | undefined;

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

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ class_fees: data || [] });
});

// Create class fee (Principal only)
router.post('/class-fees', requireRoles(['principal']), async (req, res) => {
  const { error, value } = classFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Create class fee default
    const payload = { ...value, school_id: user.schoolId };
    const { data: classFee, error: dbError } = await adminSupabase
      .from('class_fee_defaults')
      .insert(payload)
      .select(`
        *,
        class_groups:class_group_id(id, name),
        fee_categories:fee_category_id(id, name, description)
      `)
      .single();

    if (dbError) return res.status(400).json({ error: dbError.message });

    // Create initial version (effective from today)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const { error: versionError } = await adminSupabase
      .from('class_fee_versions')
      .insert({
        school_id: user.schoolId,
        class_group_id: value.class_group_id,
        fee_category_id: value.fee_category_id,
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
  } catch (err: any) {
    console.error('[create-class-fee] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create class fee' });
  }
});

// Update class fee (Principal only)
router.put('/class-fees/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = classFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('class_fee_defaults')
    .update(value)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select(`
      *,
      class_groups:class_group_id(id, name),
      fee_categories:fee_category_id(id, name, description)
    `)
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Class fee not found' });
  return res.json({ class_fee: data });
});

// Delete class fee (Principal only)
router.delete('/class-fees/:id', requireRoles(['principal']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { error } = await supabase
    .from('class_fee_defaults')
    .delete()
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId);

  if (error) return res.status(400).json({ error: error.message });
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
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('transport_routes')
    .select('*')
    .eq('school_id', user.schoolId)
    .eq('is_active', true)
    .order('route_name', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ routes: data || [] });
});

// Create transport route
router.post('/transport/routes', requireRoles(['principal']), async (req, res) => {
  const { error, value } = transportRouteSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const payload = { ...value, school_id: user.schoolId };
  const { data, error: dbError } = await supabase
    .from('transport_routes')
    .insert(payload)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ route: data });
});

// Update transport route
router.put('/transport/routes/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = transportRouteSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('transport_routes')
    .update(value)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Transport route not found' });
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
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('transport_fee_defaults')
    .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone)
    `)
    .eq('school_id', user.schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ transport_fees: data || [] });
});

// Create transport fee
router.post('/transport/fees', requireRoles(['principal']), async (req, res) => {
  const { error, value } = transportFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  // Get route to get school_id
  const { data: route, error: routeError } = await adminSupabase
    .from('transport_routes')
    .select('school_id')
    .eq('id', value.route_id)
    .single();

  if (routeError || !route || route.school_id !== user.schoolId) {
    return res.status(400).json({ error: 'Invalid route' });
  }

  const payload = { ...value, school_id: user.schoolId };
  const { data, error: dbError } = await adminSupabase
    .from('transport_fee_defaults')
    .insert(payload)
    .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone)
    `)
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ transport_fee: data });
});

// Update transport fee
router.put('/transport/fees/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = transportFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('transport_fee_defaults')
    .update(value)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select(`
      *,
      transport_routes:route_id(id, route_name, bus_number, zone)
    `)
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Transport fee not found' });
  return res.json({ transport_fee: data });
});

// ============================================
// OPTIONAL FEES
// ============================================

const optionalFeeSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('', null).optional(),
  default_amount: Joi.number().min(0).required(),
  fee_cycle: Joi.string().valid('one-time', 'monthly', 'quarterly', 'yearly').default('one-time'),
  is_active: Joi.boolean().default(true)
});

// Get optional fees
router.get('/optional', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('optional_fee_definitions')
    .select('*')
    .eq('school_id', user.schoolId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ optional_fees: data || [] });
});

// Create optional fee
router.post('/optional', requireRoles(['principal']), async (req, res) => {
  const { error, value } = optionalFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const payload = { ...value, school_id: user.schoolId };
    const { data: optionalFee, error: dbError } = await adminSupabase
      .from('optional_fee_definitions')
      .insert(payload)
      .select()
      .single();

    if (dbError) return res.status(400).json({ error: dbError.message });

    // Get first class for class_group_id (optional fees can be school-wide)
    const { data: firstClass } = await adminSupabase
      .from('class_groups')
      .select('id')
      .eq('school_id', user.schoolId)
      .limit(1)
      .single();

    // Create initial version
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const { error: versionError } = await adminSupabase
      .from('optional_fee_versions')
      .insert({
        school_id: user.schoolId,
        class_group_id: firstClass?.id || null,
        fee_category_id: optionalFee.fee_category_id || null,
        version_number: 1,
        amount: value.default_amount,
        fee_cycle: value.fee_cycle,
        effective_from_date: todayStr,
        effective_to_date: null,
        is_active: true,
        created_by: user.id
      });

    if (versionError) {
      console.error('[create-optional-fee] Error creating initial version:', versionError);
    }

    return res.status(201).json({ optional_fee: optionalFee });
  } catch (err: any) {
    console.error('[create-optional-fee] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create optional fee' });
  }
});

// Update optional fee
router.put('/optional/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = optionalFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('optional_fee_definitions')
    .update(value)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Optional fee not found' });
  return res.json({ optional_fee: data });
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
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

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

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ assignment: data });
});

// Get student transport assignments
router.get('/transport/assignments', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const studentId = req.query.student_id as string | undefined;

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

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ assignments: data || [] });
});

// ============================================
// STUDENT CUSTOM FEES
// ============================================

const studentCustomFeeSchema = Joi.object({
  student_id: Joi.string().uuid().required(),
  fee_type: Joi.string().valid('additional', 'discount', 'scholarship', 'concession', 'fine', 'late-fee', 'waiver').required(),
  description: Joi.string().required(),
  amount: Joi.number().required(), // Can be negative for discounts
  fee_cycle: Joi.string().valid('one-time', 'monthly', 'quarterly', 'yearly', 'per-bill').default('per-bill'),
  effective_from: Joi.date().default(() => new Date()),
  effective_to: Joi.date().allow(null).optional(),
  is_active: Joi.boolean().default(true),
  notes: Joi.string().allow('', null).optional()
});

// Create student custom fee
router.post('/custom', requireRoles(['principal']), async (req, res) => {
  const { error, value } = studentCustomFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const payload = {
    ...value,
    school_id: user.schoolId,
    applied_by: user.id
  };

  const { data, error: dbError } = await supabase
    .from('student_custom_fees')
    .insert(payload)
    .select(`
      *,
      students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name))
    `)
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ custom_fee: data });
});

// Get student custom fees
router.get('/custom', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const studentId = req.query.student_id as string | undefined;
  if (!studentId) {
    return res.status(400).json({ error: 'student_id is required' });
  }

  const { data, error } = await supabase
    .from('student_custom_fees')
    .select(`
      *,
      students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name))
    `)
    .eq('student_id', studentId)
    .eq('school_id', user.schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ custom_fees: data || [] });
});

// Update student custom fee
router.put('/custom/:id', requireRoles(['principal']), async (req, res) => {
  const { error, value } = studentCustomFeeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('student_custom_fees')
    .update(value)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select(`
      *,
      students:student_id(id, roll_number, profile:profiles!students_profile_id_fkey(full_name))
    `)
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Custom fee not found' });
  return res.json({ custom_fee: data });
});

// Deactivate student custom fee
router.delete('/custom/:id', requireRoles(['principal']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error: dbError } = await supabase
    .from('student_custom_fees')
    .update({ is_active: false, effective_to: new Date() })
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  if (!data) return res.status(404).json({ error: 'Custom fee not found' });
  return res.json({ success: true });
});

// ============================================
// FEE BILLS - Generation Logic
// ============================================

const generateBillSchema = Joi.object({
  student_id: Joi.string().uuid().optional(),
  class_group_id: Joi.string().uuid().optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().min(2000).max(2100).optional(),
  bill_period_start: Joi.date().optional(),
  bill_period_end: Joi.date().optional()
});

// Generate fee bills (for one student or all students in a class)
router.post('/bills/generate', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = generateBillSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const now = new Date();
    const month = value.month || now.getMonth() + 1;
    const year = value.year || now.getFullYear();
    
    // Calculate period start and end
    let periodStart: Date, periodEnd: Date;
    if (value.bill_period_start && value.bill_period_end) {
      periodStart = new Date(value.bill_period_start);
      periodEnd = new Date(value.bill_period_end);
    } else {
      // Default to monthly
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0); // Last day of month
    }

    // Get students to generate bills for
    let studentsQuery = adminSupabase
      .from('students')
      .select(`
        id,
        class_group_id,
        profile_id,
        roll_number,
        profiles:profile_id(full_name),
        class_groups:class_group_id(id, name)
      `)
      .eq('school_id', user.schoolId)
      .eq('status', 'active');

    if (value.student_id) {
      studentsQuery = studentsQuery.eq('id', value.student_id);
    } else if (value.class_group_id) {
      studentsQuery = studentsQuery.eq('class_group_id', value.class_group_id);
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError || !students || students.length === 0) {
      return res.status(400).json({ error: 'No students found' });
    }

    const generatedBills = [];

    for (const student of students) {
      // Calculate bill amounts
      let classFeesTotal = 0;
      let transportFeeTotal = 0;
      let optionalFeesTotal = 0;
      let customFeesTotal = 0;
      let fineTotal = 0;
      let discountAmount = 0;
      let scholarshipAmount = 0;

      const billItems = [];

      // 1. Class Fees
      const { data: classFees } = await adminSupabase
        .from('class_fee_defaults')
        .select('*, fee_categories:fee_category_id(name)')
        .eq('class_group_id', student.class_group_id)
        .eq('school_id', user.schoolId)
        .eq('is_active', true);

      if (classFees) {
        for (const classFee of classFees) {
          const shouldInclude = 
            (classFee.fee_cycle === 'one-time' && !classFee.due_date) ||
            (classFee.fee_cycle === 'monthly') ||
            (classFee.fee_cycle === 'quarterly' && [1, 4, 7, 10].includes(month)) ||
            (classFee.fee_cycle === 'yearly' && month === 1);

          if (shouldInclude) {
            classFeesTotal += parseFloat(classFee.amount || 0);
            billItems.push({
              item_type: 'class-fee',
              item_name: classFee.fee_categories?.name || 'Class Fee',
              amount: classFee.amount,
              total_amount: classFee.amount,
              fee_category_id: classFee.fee_category_id,
              class_fee_id: classFee.id
            });
          }
        }
      }

      // 2. Transport Fee
      const { data: transportAssignment } = await adminSupabase
        .from('student_transport')
        .select('route_id')
        .eq('student_id', student.id)
        .eq('is_active', true)
        .single();

      if (transportAssignment) {
        const { data: transportFee } = await adminSupabase
          .from('transport_fee_defaults')
          .select('*, transport_routes:route_id(route_name)')
          .eq('route_id', transportAssignment.route_id)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .single();

        if (transportFee) {
          const shouldInclude = 
            (transportFee.fee_cycle === 'monthly') ||
            (transportFee.fee_cycle === 'yearly' && month === 1);

          if (shouldInclude) {
            const totalTransportFee = parseFloat(transportFee.base_fee || 0) +
              parseFloat(transportFee.escort_fee || 0) +
              parseFloat(transportFee.fuel_surcharge || 0);
            transportFeeTotal = totalTransportFee;
            billItems.push({
              item_type: 'transport-fee',
              item_name: `Transport - ${transportFee.transport_routes?.route_name || 'Route'}`,
              amount: totalTransportFee,
              total_amount: totalTransportFee,
              transport_fee_id: transportFee.id
            });
          }
        }
      }

      // 3. Optional Fees (for now, include if they're monthly or one-time)
      const { data: optionalFees } = await adminSupabase
        .from('optional_fee_definitions')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('is_active', true);

      if (optionalFees) {
        for (const optionalFee of optionalFees) {
          const shouldInclude =
            (optionalFee.fee_cycle === 'one-time') ||
            (optionalFee.fee_cycle === 'monthly') ||
            (optionalFee.fee_cycle === 'quarterly' && [1, 4, 7, 10].includes(month)) ||
            (optionalFee.fee_cycle === 'yearly' && month === 1);

          if (shouldInclude) {
            optionalFeesTotal += parseFloat(optionalFee.default_amount || 0);
            billItems.push({
              item_type: 'optional-fee',
              item_name: optionalFee.name,
              amount: optionalFee.default_amount,
              total_amount: optionalFee.default_amount,
              optional_fee_id: optionalFee.id
            });
          }
        }
      }

      // 4. Custom Fees (discounts, scholarships, fines, etc.)
      const { data: customFees } = await adminSupabase
        .from('student_custom_fees')
        .select('*')
        .eq('student_id', student.id)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .lte('effective_from', periodEnd.toISOString())
        .or(`effective_to.is.null,effective_to.gte.${periodStart.toISOString()}`);

      if (customFees) {
        for (const customFee of customFees) {
          const shouldInclude =
            (customFee.fee_cycle === 'per-bill') ||
            (customFee.fee_cycle === 'monthly') ||
            (customFee.fee_cycle === 'one-time' && month === new Date(customFee.effective_from).getMonth() + 1);

          if (shouldInclude) {
            const amount = parseFloat(customFee.amount || 0);
            customFeesTotal += amount;

            if (['discount', 'scholarship', 'concession', 'waiver'].includes(customFee.fee_type)) {
              if (customFee.fee_type === 'discount' || customFee.fee_type === 'concession') {
                discountAmount += Math.abs(amount);
              } else if (customFee.fee_type === 'scholarship') {
                scholarshipAmount += Math.abs(amount);
              }
            } else if (customFee.fee_type === 'fine' || customFee.fee_type === 'late-fee') {
              fineTotal += Math.abs(amount);
            }

            billItems.push({
              item_type: customFee.fee_type === 'fine' ? 'fine' : 'custom-fee',
              item_name: customFee.description,
              amount: amount,
              total_amount: amount,
              custom_fee_id: customFee.id
            });
          }
        }
      }

      // Calculate totals
      const grossAmount = classFeesTotal + transportFeeTotal + optionalFeesTotal + Math.max(0, customFeesTotal);
      const netAmount = Math.max(0, grossAmount - discountAmount - scholarshipAmount + fineTotal);

      // Get due date (default to end of period)
      const dueDay = classFees && classFees.length > 0 ? (classFees[0]?.due_day || 5) : 5; // Default to 5th of next month
      const dueDate = new Date(year, month, dueDay);

      // Generate bill number
      const { data: billNumberData } = await adminSupabase.rpc('generate_bill_number', {
        school_uuid: user.schoolId
      });

      // Create bill
      const billPayload = {
        student_id: student.id,
        school_id: user.schoolId,
        bill_number: billNumberData || `${user.schoolId.substring(0, 3).toUpperCase()}-${year}${String(month).padStart(2, '0')}-${Date.now()}`,
        bill_period_start: periodStart.toISOString().split('T')[0],
        bill_period_end: periodEnd.toISOString().split('T')[0],
        bill_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        class_fees_total: classFeesTotal,
        transport_fee_total: transportFeeTotal,
        optional_fees_total: optionalFeesTotal,
        custom_fees_total: customFeesTotal,
        fine_total: fineTotal,
        gross_amount: grossAmount,
        discount_amount: discountAmount,
        scholarship_amount: scholarshipAmount,
        net_amount: netAmount,
        status: 'pending',
        generated_by: user.id
      };

      const { data: bill, error: billError } = await adminSupabase
        .from('fee_bills')
        .insert(billPayload)
        .select()
        .single();

      if (billError) {
        console.error('Error creating bill:', billError);
        continue;
      }

      // Create bill items
      for (let i = 0; i < billItems.length; i++) {
        await adminSupabase
          .from('fee_bill_items')
          .insert({
            bill_id: bill.id,
            ...billItems[i],
            display_order: i + 1
          });
      }

      generatedBills.push(bill);
    }

    return res.json({
      success: true,
      bills_generated: generatedBills.length,
      bills: generatedBills
    });
  } catch (err: any) {
    console.error('Error generating bills:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate bills' });
  }
});

// Get fee bills
router.get('/bills', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const studentId = req.query.student_id as string | undefined;
  const status = req.query.status as string | undefined;

  let query = supabase
    .from('fee_bills')
    .select(`
      *,
      students:student_id(
        id,
        roll_number,
        profile:profiles!students_profile_id_fkey(full_name),
        class_groups:class_group_id(name)
      ),
      fee_payments(*)
    `)
    .eq('school_id', user.schoolId)
    .order('created_at', { ascending: false });

  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });

  // Calculate paid amount for each bill
  const billsWithPaid = (data || []).map((bill: any) => {
    const totalPaid = (bill.fee_payments || []).reduce((sum: number, payment: any) => sum + parseFloat(payment.amount_paid || 0), 0);
    return {
      ...bill,
      total_paid: totalPaid,
      balance: Math.max(0, bill.net_amount - totalPaid)
    };
  });

  return res.json({ bills: billsWithPaid });
});

// Get single bill with items
router.get('/bills/:id', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data: bill, error: billError } = await supabase
    .from('fee_bills')
    .select(`
      *,
      students:student_id(
        id,
        roll_number,
        profile:profiles!students_profile_id_fkey(full_name),
        class_groups:class_group_id(name)
      )
    `)
    .eq('id', req.params.id)
    .eq('school_id', user.schoolId)
    .single();

  if (billError || !bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  const { data: items } = await supabase
    .from('fee_bill_items')
    .select('*')
    .eq('bill_id', bill.id)
    .order('display_order', { ascending: true });

  const { data: payments } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('bill_id', bill.id)
    .order('payment_date', { ascending: false });

  const totalPaid = (payments || []).reduce((sum: number, payment: any) => sum + parseFloat(payment.amount_paid || 0), 0);

  return res.json({
    bill: {
      ...bill,
      items: items || [],
      payments: payments || [],
      total_paid: totalPaid,
      balance: Math.max(0, bill.net_amount - totalPaid)
    }
  });
});

// ============================================
// FEE PAYMENTS
// ============================================

const feePaymentSchema = Joi.object({
  bill_id: Joi.string().uuid().required(),
  amount_paid: Joi.number().positive().required(),
  payment_mode: Joi.string().valid('cash', 'online', 'upi', 'card', 'cheque', 'bank-transfer').required(),
  transaction_id: Joi.string().allow('', null).optional(),
  cheque_number: Joi.string().allow('', null).optional(),
  bank_name: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional()
});

// Create payment
router.post('/payments', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = feePaymentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  // Get bill
  const { data: bill, error: billError } = await adminSupabase
    .from('fee_bills')
    .select('*, students:student_id(id)')
    .eq('id', value.bill_id)
    .eq('school_id', user.schoolId)
    .single();

  if (billError || !bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  // Generate payment number
  const { data: paymentNumberData } = await adminSupabase.rpc('generate_payment_number', {
    school_uuid: user.schoolId
  });

  const paymentPayload = {
    bill_id: value.bill_id,
    student_id: bill.students.id,
    school_id: user.schoolId,
    payment_number: paymentNumberData || `PMT-${Date.now()}`,
    amount_paid: value.amount_paid,
    payment_mode: value.payment_mode,
    transaction_id: value.transaction_id,
    cheque_number: value.cheque_number,
    bank_name: value.bank_name,
    received_by: user.id,
    notes: value.notes
  };

  const { data: payment, error: paymentError } = await adminSupabase
    .from('fee_payments')
    .insert(paymentPayload)
    .select(`
      *,
      fee_bills:bill_id(*)
    `)
    .single();

  if (paymentError) return res.status(400).json({ error: paymentError.message });

  // Log payment
  await adminSupabase.from('clerk_logs').insert({
    clerk_id: user.id,
    school_id: user.schoolId,
    action: 'fee_payment_recorded',
    entity: 'fee_payment',
    entity_id: payment.id
  });

  return res.status(201).json({ payment });
});

// Get payments
router.get('/payments', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const billId = req.query.bill_id as string | undefined;
  const studentId = req.query.student_id as string | undefined;

  let query = supabase
    .from('fee_payments')
    .select(`
      *,
      fee_bills:bill_id(bill_number, net_amount),
      students:student_id(roll_number, profile:profiles!students_profile_id_fkey(full_name))
    `)
    .eq('school_id', user.schoolId)
    .order('payment_date', { ascending: false });

  if (billId) {
    query = query.eq('bill_id', billId);
  }

  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ payments: data || [] });
});

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
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

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

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ cycle: data });
});

// Get student fee cycles
router.get('/student-cycles/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('student_fee_cycles')
    .select('*')
    .eq('student_id', req.params.studentId)
    .eq('school_id', user.schoolId)
    .eq('is_active', true)
    .order('effective_from', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
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

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { generateStudentFeeSchedule } = await import('../utils/feeBilling.js');
    if (!user.schoolId) {
      return res.status(500).json({ error: 'School ID not found' });
    }
    const periods = await generateStudentFeeSchedule(
      student_id,
      user.schoolId,
      academic_year,
      adminSupabase
    );

    return res.json({ 
      message: 'Fee schedule generated successfully',
      periods: periods.length 
    });
  } catch (err: any) {
    console.error('[generate-schedule] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate schedule' });
  }
});

// Get pending periods for student
router.get('/periods/pending/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { getPendingPeriods } = await import('../utils/feeBilling.js');
    const periods = await getPendingPeriods(req.params.studentId, adminSupabase);
    return res.json({ periods });
  } catch (err: any) {
    console.error('[pending-periods] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get pending periods' });
  }
});

// Get overdue periods for student
router.get('/periods/overdue/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { getOverduePeriods } = await import('../utils/feeBilling.js');
    const periods = await getOverduePeriods(req.params.studentId, adminSupabase);
    return res.json({ periods });
  } catch (err: any) {
    console.error('[overdue-periods] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get overdue periods' });
  }
});

// Get total dues for student
router.get('/dues/:studentId', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { getStudentTotalDues } = await import('../utils/feeBilling.js');
    const dues = await getStudentTotalDues(req.params.studentId, adminSupabase);
    return res.json({ dues });
  } catch (err: any) {
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
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

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
    const versionId = await hikeClassFee(
      user.schoolId,
      classFee.class_group_id,
      classFee.fee_category_id,
      classFee.fee_cycle,
      value.new_amount,
      effectiveFromDate,
      user.id,
      adminSupabase
    );

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
  } catch (err: any) {
    console.error('[fee-hike] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to hike fee' });
  }
});

// Hike Transport Fee
router.post('/transport/fees/:id/hike', requireRoles(['principal']), async (req, res) => {
  const { error, value } = feeHikeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get transport fee default
    const { data: transportFee, error: feeError } = await adminSupabase
      .from('transport_fee_defaults')
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

    const classGroupId = route?.class_group_id || transportFee.class_group_id;
    const routeName = transportFee.transport_routes?.route_name || null;
    const totalAmount = parseFloat(transportFee.base_fee || 0) + 
                       parseFloat(transportFee.escort_fee || 0) + 
                       parseFloat(transportFee.fuel_surcharge || 0);

    // Import fee versioning utilities
    const { hikeTransportFee } = await import('../utils/feeVersioning.js');

    const effectiveFromDate = new Date(value.effective_from_date);
    const versionId = await hikeTransportFee(
      user.schoolId,
      classGroupId,
      routeName,
      transportFee.fee_cycle,
      value.new_amount,
      effectiveFromDate,
      user.id,
      adminSupabase
    );

    // Update transport_fee_defaults
    await adminSupabase
      .from('transport_fee_defaults')
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
  } catch (err: any) {
    console.error('[transport-fee-hike] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to hike transport fee' });
  }
});

// Hike Optional Fee
router.post('/optional/:id/hike', requireRoles(['principal']), async (req, res) => {
  const { error, value } = feeHikeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get optional fee definition
    const { data: optionalFee, error: feeError } = await adminSupabase
      .from('optional_fee_definitions')
      .select('*')
      .eq('id', req.params.id)
      .eq('school_id', user.schoolId)
      .single();

    if (feeError || !optionalFee) {
      return res.status(404).json({ error: 'Optional fee not found' });
    }

    // Get class_group_id (optional fees can be class-specific or school-wide)
    // For now, we'll use a default or get from the first class
    const { data: firstClass } = await adminSupabase
      .from('class_groups')
      .select('id')
      .eq('school_id', user.schoolId)
      .limit(1)
      .single();

    const classGroupId = firstClass?.id || null;

    // Get current max version number for optional fee
    const { data: currentVersion, error: versionError } = await adminSupabase
      .from('optional_fee_versions')
      .select('version_number')
      .eq('school_id', user.schoolId)
      .eq('class_group_id', classGroupId)
      .eq('fee_category_id', optionalFee.fee_category_id || null)
      .eq('fee_cycle', optionalFee.fee_cycle)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;
    const effectiveFromDate = new Date(value.effective_from_date);
    const effectiveFromStr = effectiveFromDate.toISOString().split('T')[0];
    const previousEffectiveTo = new Date(effectiveFromDate);
    previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);
    const previousEffectiveToStr = previousEffectiveTo.toISOString().split('T')[0];

    // Close previous active version
    await adminSupabase
      .from('optional_fee_versions')
      .update({
        effective_to_date: previousEffectiveToStr,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('school_id', user.schoolId)
      .eq('class_group_id', classGroupId)
      .eq('fee_category_id', optionalFee.fee_category_id || null)
      .eq('fee_cycle', optionalFee.fee_cycle)
      .eq('is_active', true)
      .or(`effective_to_date.is.null,effective_to_date.gte.${effectiveFromStr}`);

    // Create new version
    const { data: newVersion, error: createError } = await adminSupabase
      .from('optional_fee_versions')
      .insert({
        school_id: user.schoolId,
        class_group_id: classGroupId,
        fee_category_id: optionalFee.fee_category_id || null,
        version_number: newVersionNumber,
        amount: value.new_amount,
        fee_cycle: optionalFee.fee_cycle,
        effective_from_date: effectiveFromStr,
        effective_to_date: null,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create new version: ${createError.message}`);
    }

    // Update optional_fee_definitions
    await adminSupabase
      .from('optional_fee_definitions')
      .update({ 
        default_amount: value.new_amount,
        updated_at: new Date().toISOString() 
      })
      .eq('id', req.params.id);

    return res.json({
      success: true,
      message: 'Optional fee hike applied successfully',
      version_id: newVersion.id,
      new_amount: value.new_amount,
      effective_from_date: effectiveFromStr
    });
  } catch (err: any) {
    console.error('[optional-fee-hike] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to hike optional fee' });
  }
});

// Get Class Fee Version History
router.get('/class-fees/:id/versions', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

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
  } catch (err: any) {
    console.error('[fee-versions] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get fee versions' });
  }
});

// Get Transport Fee Version History
router.get('/transport/fees/:id/versions', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get transport fee default
    const { data: transportFee, error: feeError } = await adminSupabase
      .from('transport_fee_defaults')
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
    } else {
      query = query.is('route_name', null);
    }

    const { data: versions, error: versionsError } = await query;

    if (versionsError) {
      throw new Error(versionsError.message);
    }

    return res.json({ versions: versions || [] });
  } catch (err: any) {
    console.error('[transport-versions] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get transport fee versions' });
  }
});

// Get Optional Fee Version History
router.get('/optional/:id/versions', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get optional fee definition
    const { data: optionalFee, error: feeError } = await adminSupabase
      .from('optional_fee_definitions')
      .select('fee_category_id, fee_cycle')
      .eq('id', req.params.id)
      .eq('school_id', user.schoolId)
      .single();

    if (feeError || !optionalFee) {
      return res.status(404).json({ error: 'Optional fee not found' });
    }

    // Get all versions
    const { data: versions, error: versionsError } = await adminSupabase
      .from('optional_fee_versions')
      .select('*')
      .eq('school_id', user.schoolId)
      .eq('fee_category_id', optionalFee.fee_category_id || null)
      .eq('fee_cycle', optionalFee.fee_cycle)
      .order('version_number', { ascending: false });

    if (versionsError) {
      throw new Error(versionsError.message);
    }

    return res.json({ versions: versions || [] });
  } catch (err: any) {
    console.error('[optional-versions] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get optional fee versions' });
  }
});

export default router;

