import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Salary Structure Schema
const salaryStructureSchema = Joi.object({
  teacher_id: Joi.string().uuid().required(),
  base_salary: Joi.number().min(0).required(),
  hra: Joi.number().min(0).default(0),
  other_allowances: Joi.number().min(0).default(0),
  fixed_deductions: Joi.number().min(0).default(0),
  salary_cycle: Joi.string().valid('monthly', 'weekly', 'biweekly').default('monthly'),
  attendance_based_deduction: Joi.boolean().default(false),
  effective_from_date: Joi.date().required() // Required: When creating/editing, principal must specify effective from date
});

// Generate Salary Schema
const generateSalarySchema = Joi.object({
  teacher_id: Joi.string().uuid().required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required()
});

// Update Salary Record Schema
const updateSalaryRecordSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'paid').optional(),
  payment_date: Joi.date().optional(),
  notes: Joi.string().allow('', null).optional()
});

// Reject Salary Schema
const rejectSalarySchema = Joi.object({
  rejection_reason: Joi.string().required().min(5).max(500)
});

// Mark Paid Schema
const markPaidSchema = Joi.object({
  payment_date: Joi.date().required(),
  payment_mode: Joi.string().valid('bank', 'cash', 'upi').required(),
  payment_proof: Joi.string().allow('', null).optional(), // URL or file path
  notes: Joi.string().allow('', null).optional()
});

// Record Payment Schema (Simplified System)
const recordPaymentSchema = Joi.object({
  teacher_id: Joi.string().uuid().required(),
  payment_date: Joi.date().required(),
  amount: Joi.number().min(0.01).required(),
  payment_mode: Joi.string().valid('bank', 'cash', 'upi').required(),
  payment_proof: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional()
});

// Create or Update Teacher Salary Structure (Principal only)
router.post('/structure', requireRoles(['principal']), async (req, res) => {
  const { error, value } = salaryStructureSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify teacher belongs to the school
    const { data: teacher, error: teacherError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Validate effective_from_date is provided (already validated by Joi, but double-check)
    if (!value.effective_from_date) {
      return res.status(400).json({ error: 'Effective from date is required' });
    }

    // Determine effective_from_date for new salary structure
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    let effectiveFromDate: string = value.effective_from_date;
    
    // Validate date format
    const effectiveFromDateObj = new Date(effectiveFromDate);
    if (isNaN(effectiveFromDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid effective from date format' });
    }

    // Check if there's an existing active structure
    const { data: existingActive } = await adminSupabase
      .from('teacher_salary_structure')
      .select('id, effective_from, effective_to')
      .eq('teacher_id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .is('effective_to', null)
      .maybeSingle();

    // Edge case: If there's an existing active structure, validate the new date
    if (existingActive) {
      const existingEffectiveFrom = new Date(existingActive.effective_from);
      existingEffectiveFrom.setHours(0, 0, 0, 0);
      const newEffectiveFrom = new Date(effectiveFromDate);
      newEffectiveFrom.setHours(0, 0, 0, 0);
      
      // New effective date must be after the existing effective date
      if (newEffectiveFrom <= existingEffectiveFrom) {
        return res.status(400).json({ 
          error: `New effective from date must be after the current structure's effective date (${existingActive.effective_from}). The new salary structure should start after the existing one.` 
        });
      }

      // Calculate the day before the new effective_from_date
      const dayBeforeEffectiveFrom = new Date(newEffectiveFrom);
      dayBeforeEffectiveFrom.setDate(dayBeforeEffectiveFrom.getDate() - 1);
      const dayBeforeStr = dayBeforeEffectiveFrom.toISOString().split('T')[0];

      // Close old structure
      const { error: closeError } = await adminSupabase
        .from('teacher_salary_structure')
        .update({
          effective_to: dayBeforeStr,
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingActive.id);

      if (closeError) {
        console.error('[salary] Error closing old structure:', closeError);
        return res.status(400).json({ error: closeError.message });
      }
    } else {
      // For new structures (no existing active structure), validate that date is not too far in the past
      // Allow past dates for initial salary structures but warn if it's too far back (e.g., more than 1 year)
      const newEffectiveFrom = new Date(effectiveFromDate);
      newEffectiveFrom.setHours(0, 0, 0, 0);
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (newEffectiveFrom < oneYearAgo) {
        // Allow it but log a warning (might want to notify the principal)
        console.warn(`[salary] Warning: Creating salary structure with effective date more than 1 year in the past: ${effectiveFromDate}`);
      }
    }

    // Create new structure with effective_from_date
    const { data: result, error: insertError } = await adminSupabase
      .from('teacher_salary_structure')
      .insert({
        teacher_id: value.teacher_id,
        school_id: user.schoolId,
        base_salary: value.base_salary,
        hra: value.hra,
        other_allowances: value.other_allowances,
        fixed_deductions: value.fixed_deductions,
        salary_cycle: value.salary_cycle,
        attendance_based_deduction: value.attendance_based_deduction,
        effective_from: effectiveFromDate,
        effective_to: null, // Active until closed by future update
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('[salary] Error creating structure:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    return res.json({ structure: result });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get Salary Structure for a Teacher
router.get('/structure/:teacherId', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacherId } = req.params;

  // Teachers can only view their own structure
  if (user.role === 'teacher' && user.id !== teacherId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Get the active structure for the teacher
    // If date is provided in query, get structure active for that date; otherwise get currently active
    const targetDate = req.query.date ? new Date(req.query.date as string).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    const { data: structure, error } = await adminSupabase
      .from('teacher_salary_structure')
      .select(`
        *,
        teacher:profiles!teacher_salary_structure_teacher_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('teacher_id', teacherId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .lte('effective_from', targetDate)
      .or(`effective_to.is.null,effective_to.gte.${targetDate}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[salary] Error fetching structure:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ structure: structure || null });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get All Salary Structures (Principal/Clerk only)
router.get('/structures', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Get only active structures (currently effective)
    const today = new Date().toISOString().split('T')[0];
    const { data: structures, error } = await adminSupabase
      .from('teacher_salary_structure')
      .select(`
        *,
        teacher:profiles!teacher_salary_structure_teacher_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[salary] Error fetching structures:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ structures: structures || [] });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Calculate attendance deduction for a month
async function calculateAttendanceDeduction(
  adminSupabase: any,
  teacherId: string,
  month: number,
  year: number,
  baseSalary: number
): Promise<number> {
  // Get first and last day of the month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Get absent days for the month
  const { data: attendance, error } = await adminSupabase
    .from('teacher_attendance')
    .select('date, status')
    .eq('teacher_id', teacherId)
    .gte('date', firstDay.toISOString().split('T')[0])
    .lte('date', lastDay.toISOString().split('T')[0])
    .eq('status', 'absent');

  if (error) {
    console.error('[salary] Error fetching attendance:', error);
    return 0;
  }

  const absentDays = attendance?.length || 0;
  const perDaySalary = baseSalary / 30; // Assuming 30 days per month
  return absentDays * perDaySalary;
}

// Generate Monthly Salary (Clerk or Principal can generate, but status is always 'pending')
router.post('/generate', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = generateSalarySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify teacher belongs to the school
    const { data: teacher, error: teacherError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Get salary structure active for the salary month/year
    // Use the first day of the month for the target date
    const targetDate = new Date(value.year, value.month - 1, 1).toISOString().split('T')[0];
    
    const { data: structure, error: structureError } = await adminSupabase
      .from('teacher_salary_structure')
      .select('*')
      .eq('teacher_id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .lte('effective_from', targetDate)
      .or(`effective_to.is.null,effective_to.gte.${targetDate}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (structureError || !structure) {
      return res.status(400).json({ error: 'Salary structure not found. Please set salary structure first.' });
    }

    // Check if salary already exists for this month
    const { data: existing } = await adminSupabase
      .from('teacher_salary_records')
      .select('id')
      .eq('teacher_id', value.teacher_id)
      .eq('month', value.month)
      .eq('year', value.year)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Salary already generated for this month' });
    }

    // Calculate gross salary
    const grossSalary = structure.base_salary + structure.hra + structure.other_allowances;

    // Calculate attendance deduction if enabled
    let attendanceDeduction = 0;
    if (structure.attendance_based_deduction) {
      attendanceDeduction = await calculateAttendanceDeduction(
        adminSupabase,
        value.teacher_id,
        value.month,
        value.year,
        structure.base_salary
      );
    }

    // Calculate total deductions
    const totalDeductions = structure.fixed_deductions + attendanceDeduction;

    // Calculate net salary
    const netSalary = grossSalary - totalDeductions;

    // Create salary record with status 'pending' (requires principal approval)
    // Log who generated it for audit
    const { data: salaryRecord, error: insertError } = await adminSupabase
      .from('teacher_salary_records')
      .insert({
        teacher_id: value.teacher_id,
        school_id: user.schoolId,
        salary_structure_id: structure.id,
        month: value.month,
        year: value.year,
        gross_salary: grossSalary,
        total_deductions: totalDeductions,
        attendance_deduction: attendanceDeduction,
        net_salary: netSalary,
        status: 'pending', // Always pending - requires principal approval
        generated_by: user.id // Audit: who generated this salary
      })
      .select(`
        *,
        teacher:profiles!teacher_salary_records_teacher_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .single();

    if (insertError) {
      console.error('[salary] Error creating salary record:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    return res.json({ salaryRecord });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get Salary Records
router.get('/records', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacher_id, month, year, status } = req.query;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    let query = adminSupabase
      .from('teacher_salary_records')
      .select(`
        *,
        teacher:profiles!teacher_salary_records_teacher_id_fkey(
          id,
          full_name,
          email
        ),
        approved_by_profile:profiles!teacher_salary_records_approved_by_fkey(
          id,
          full_name
        ),
        generated_by_profile:profiles!teacher_salary_records_generated_by_fkey(
          id,
          full_name
        ),
        paid_by_profile:profiles!teacher_salary_records_paid_by_fkey(
          id,
          full_name
        )
      `)
      .eq('school_id', user.schoolId);

    // Teachers can only see their own records
    if (user.role === 'teacher') {
      query = query.eq('teacher_id', user.id);
    } else if (teacher_id) {
      query = query.eq('teacher_id', teacher_id as string);
    }

    if (month) query = query.eq('month', parseInt(month as string));
    if (year) query = query.eq('year', parseInt(year as string));
    if (status) {
      // For clerks, only show approved salaries in payment section (handled in frontend)
      // But allow viewing all statuses for records tab
      query = query.eq('status', status as string);
    }

    const { data: records, error } = await query
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      console.error('[salary] Error fetching records:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ records: records || [] });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Approve Salary Record (Principal only)
router.put('/records/:recordId/approve', requireRoles(['principal']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { recordId } = req.params;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify record belongs to school
    const { data: record, error: recordError } = await adminSupabase
      .from('teacher_salary_records')
      .select('id, status, school_id')
      .eq('id', recordId)
      .eq('school_id', user.schoolId)
      .single();

    if (recordError || !record) {
      return res.status(404).json({ error: 'Salary record not found or access denied' });
    }

    if (record.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending salaries can be approved' });
    }

    // Update record - Principal approves
    const { data: updated, error: updateError } = await adminSupabase
      .from('teacher_salary_records')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: null // Clear any previous rejection reason
      })
      .eq('id', recordId)
      .select(`
        *,
        teacher:profiles!teacher_salary_records_teacher_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .single();

    if (updateError) {
      console.error('[salary] Error approving record:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    return res.json({ salaryRecord: updated });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Mark Salary as Paid (Clerk only, and only for approved salaries)
router.put('/records/:recordId/mark-paid', requireRoles(['clerk']), async (req, res) => {
  const { error, value } = markPaidSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { recordId } = req.params;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify record belongs to school
    const { data: record, error: recordError } = await adminSupabase
      .from('teacher_salary_records')
      .select('id, status, school_id')
      .eq('id', recordId)
      .eq('school_id', user.schoolId)
      .single();

    if (recordError || !record) {
      return res.status(404).json({ error: 'Salary record not found or access denied' });
    }

    // Enforce: Only approved salaries can be paid
    if (record.status !== 'approved') {
      return res.status(400).json({ 
        error: `Only approved salaries can be marked as paid. Current status: ${record.status}. Please ensure Principal has approved this salary.` 
      });
    }

    // Update record - Clerk marks as paid with payment details
    const updateData: any = {
      status: 'paid',
      payment_date: value.payment_date,
      payment_mode: value.payment_mode,
      paid_by: user.id, // Audit: who marked as paid
      paid_at: new Date().toISOString()
    };
    if (value.payment_proof) updateData.payment_proof = value.payment_proof;
    if (value.notes !== undefined) updateData.notes = value.notes;

    const { data: updated, error: updateError } = await adminSupabase
      .from('teacher_salary_records')
      .update(updateData)
      .eq('id', recordId)
      .select(`
        *,
        teacher:profiles!teacher_salary_records_teacher_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .single();

    if (updateError) {
      console.error('[salary] Error marking as paid:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    return res.json({ salaryRecord: updated });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get Salary Reports/Analytics
router.get('/reports', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { year, month } = req.query;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    let query = adminSupabase
      .from('teacher_salary_records')
      .select('*')
      .eq('school_id', user.schoolId);

    if (year) query = query.eq('year', parseInt(year as string));
    if (month) query = query.eq('month', parseInt(month as string));

    const { data: records, error } = await query;

    if (error) {
      console.error('[salary] Error fetching reports:', error);
      return res.status(400).json({ error: error.message });
    }

    // Calculate analytics
    const totalPaid = (records || [])
      .filter((r: any) => r.status === 'paid')
      .reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0);

    const totalPending = (records || [])
      .filter((r: any) => r.status === 'pending')
      .reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0);

    const totalApproved = (records || [])
      .filter((r: any) => r.status === 'approved')
      .reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0);

    const totalAttendanceDeduction = (records || [])
      .reduce((sum: number, r: any) => sum + parseFloat(r.attendance_deduction || 0), 0);

    return res.json({
      records: records || [],
      analytics: {
        totalPaid,
        totalPending,
        totalApproved,
        totalAttendanceDeduction,
        totalRecords: records?.length || 0
      }
    });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ============================================================================
// Simplified Salary Payment System Routes
// ============================================================================

// Record Salary Payment (Clerk only - supports full, partial, or advance payments)
router.post('/payments', requireRoles(['clerk']), async (req, res) => {
  const { error, value } = recordPaymentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify teacher belongs to the school
    const { data: teacher, error: teacherError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Record the payment
    const { data: payment, error: insertError } = await adminSupabase
      .from('teacher_salary_payments')
      .insert({
        teacher_id: value.teacher_id,
        school_id: user.schoolId,
        payment_date: value.payment_date,
        amount: value.amount,
        payment_mode: value.payment_mode,
        payment_proof: value.payment_proof || null,
        notes: value.notes || null,
        paid_by: user.id
      })
      .select(`
        *,
        teacher:profiles!teacher_salary_payments_teacher_id_fkey(
          id,
          full_name,
          email
        ),
        paid_by_profile:profiles!teacher_salary_payments_paid_by_fkey(
          id,
          full_name
        )
      `)
      .single();

    if (insertError) {
      console.error('[salary] Error recording payment:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    return res.json({ payment });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get Payment History (Principal, Clerk, Teacher - teachers see only their own)
router.get('/payments', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacher_id, start_date, end_date } = req.query;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    let query = adminSupabase
      .from('teacher_salary_payments')
      .select(`
        *,
        teacher:profiles!teacher_salary_payments_teacher_id_fkey(
          id,
          full_name,
          email
        ),
        paid_by_profile:profiles!teacher_salary_payments_paid_by_fkey(
          id,
          full_name
        )
      `)
      .eq('school_id', user.schoolId);

    // Teachers can only see their own payments
    if (user.role === 'teacher') {
      query = query.eq('teacher_id', user.id);
    } else if (teacher_id) {
      query = query.eq('teacher_id', teacher_id as string);
    }

    if (start_date) {
      query = query.gte('payment_date', start_date as string);
    }
    if (end_date) {
      query = query.lte('payment_date', end_date as string);
    }

    const { data: payments, error } = await query
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[salary] Error fetching payments:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ payments: payments || [] });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get Salary Summary (Principal, Clerk, Teacher - teachers see only their own)
router.get('/summary', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacher_id } = req.query;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Get teacher IDs to query
    let teacherIds: string[] = [];

    if (user.role === 'teacher') {
      teacherIds = [user.id];
    } else if (teacher_id) {
      // Verify teacher belongs to school
      const { data: teacher, error: teacherError } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', teacher_id as string)
        .eq('school_id', user.schoolId)
        .eq('role', 'teacher')
        .single();

      if (teacherError || !teacher) {
        return res.status(404).json({ error: 'Teacher not found or access denied' });
      }
      teacherIds = [teacher_id as string];
    } else {
      // Get all teachers in school
      const { data: teachers, error: teachersError } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('role', 'teacher');

      if (teachersError) {
        return res.status(400).json({ error: teachersError.message });
      }
      teacherIds = (teachers || []).map((t: any) => t.id);
    }

    // Calculate summary for each teacher
    const summaries = await Promise.all(
      teacherIds.map(async (tid) => {
        // Get teacher info
        const { data: teacher } = await adminSupabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', tid)
          .single();

        // Calculate totals using database functions
        const { data: dueData, error: dueError } = await adminSupabase.rpc('calculate_teacher_salary_due', {
          p_teacher_id: tid,
          p_school_id: user.schoolId,
          p_as_of_date: new Date().toISOString().split('T')[0]
        });
        const total_due = parseFloat(String(dueData || 0));

        const { data: paidData, error: paidError } = await adminSupabase.rpc('calculate_teacher_salary_paid', {
          p_teacher_id: tid,
          p_school_id: user.schoolId,
          p_as_of_date: new Date().toISOString().split('T')[0]
        });
        const total_paid = parseFloat(String(paidData || 0));

        const pending = total_due - total_paid;

        // Get active salary structure
        const { data: structure } = await adminSupabase
          .from('teacher_salary_structure')
          .select('*')
          .eq('teacher_id', tid)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .is('effective_to', null)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get all salary structures (for history)
        const { data: structures } = await adminSupabase
          .from('teacher_salary_structure')
          .select('*')
          .eq('teacher_id', tid)
          .eq('school_id', user.schoolId)
          .order('effective_from', { ascending: false });

        return {
          teacher,
          total_salary_due: total_due,
          total_salary_paid: total_paid,
          pending_salary: pending,
          current_structure: structure,
          salary_structures: structures || []
        };
      })
    );

    // If single teacher requested, return single object; otherwise return array
    if (teacher_id || user.role === 'teacher') {
      return res.json({ summary: summaries[0] || null });
    }

    return res.json({ summaries });
  } catch (err: any) {
    console.error('[salary] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

