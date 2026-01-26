import { Router } from 'express';
import Joi from 'joi';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

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
  notes: Joi.string().allow('', null).optional(),
  salary_month: Joi.number().integer().min(1).max(12).required(),
  salary_year: Joi.number().integer().min(2000).max(2100).required(),
  payment_type: Joi.string().valid('salary', 'advance', 'adjustment', 'bonus', 'loan', 'other').optional().default('salary')
});

// Create or Update Teacher Salary Structure (Principal only)
router.post('/structure', requireRoles(['principal']), async (req, res) => {
  const { error, value } = salaryStructureSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });



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
      .select('id, teacher_id, base_salary, hra, other_allowances, fixed_deductions, salary_cycle, attendance_based_deduction, effective_from, effective_to, is_active')
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



  try {
    // Add pagination (critical for 1M+ users)
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    let query = adminSupabase
      .from('teacher_salary_records')
      .select('id, teacher_id, year, month, base_salary, hra, other_allowances, fixed_deductions, total_salary, attendance_deduction, final_salary, status, approved_by, school_id, created_at', { count: 'exact' })
      .eq('school_id', user.schoolId);

    if (year) query = query.eq('year', parseInt(year as string));
    if (month) query = query.eq('month', parseInt(month as string));

    const { data: records, error, count } = await query;

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
        totalRecords: count || records?.length || 0
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
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

    // Get expected salary for the month
    const { data: salaryStructure, error: structureError } = await adminSupabase
      .from('teacher_salary_structure')
      .select('base_salary, hra, other_allowances, fixed_deductions')
      .eq('teacher_id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (structureError) {
      console.error('[salary] Error fetching salary structure:', structureError);
      return res.status(400).json({ error: 'Failed to fetch salary structure' });
    }

    if (!salaryStructure) {
      return res.status(400).json({ error: 'Salary structure not found for this teacher' });
    }

    const expectedSalary = 
      salaryStructure.base_salary + 
      salaryStructure.hra + 
      salaryStructure.other_allowances - 
      salaryStructure.fixed_deductions;

    // Get existing payments for this month (to calculate total)
    const { data: existingPayments, error: paymentsError } = await adminSupabase
      .from('teacher_salary_payments')
      .select('amount')
      .eq('teacher_id', value.teacher_id)
      .eq('salary_month', value.salary_month)
      .eq('salary_year', value.salary_year);

    if (paymentsError) {
      console.error('[salary] Error fetching existing payments:', paymentsError);
      return res.status(400).json({ error: 'Failed to fetch existing payments' });
    }

    // Calculate total payment for this month (existing + new)
    const existingTotal = (existingPayments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
    const newTotal = existingTotal + parseFloat(value.amount);
    const excessAmount = newTotal > expectedSalary ? newTotal - expectedSalary : 0;

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
        salary_month: value.salary_month,
        salary_year: value.salary_year,
        payment_type: value.payment_type || 'salary',
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

    // If there's an excess amount, create credit and apply to future months
    let creditInfo = null;
    if (excessAmount > 0) {
      try {
        // Call the database function to apply credits
        const { data: creditResult, error: creditError } = await adminSupabase.rpc(
          'apply_salary_credits_to_future_months',
          {
            p_teacher_id: value.teacher_id,
            p_school_id: user.schoolId,
            p_new_credit_amount: excessAmount
          }
        );

        if (creditError) {
          console.error('[salary] Error applying credits:', creditError);
          // Don't fail the payment, just log the error
          // The credit can be applied manually later if needed
        } else {
          // Update credit record with source payment info
          if (creditResult && creditResult.credit_id) {
            await adminSupabase
              .from('teacher_salary_credits')
              .update({
                source_payment_id: payment.id,
                source_month: value.salary_month,
                source_year: value.salary_year,
                notes: `Overpayment from ${value.salary_month}/${value.salary_year} payment of ₹${value.amount}. Excess: ₹${excessAmount.toFixed(2)}`
              })
              .eq('id', creditResult.credit_id);
          }
          creditInfo = creditResult;
        }
      } catch (creditErr: any) {
        console.error('[salary] Error in credit application:', creditErr);
        // Payment is already recorded, so we continue
      }
    }

    return res.json({ 
      payment,
      credit_applied: creditInfo,
      excess_amount: excessAmount,
      message: excessAmount > 0 
        ? `Payment recorded. Excess amount of ₹${excessAmount.toFixed(2)} has been applied as credit to future unpaid months.`
        : 'Payment recorded successfully.'
    });
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

    // Use RPC function to get all summaries in one query (replaces N+1 Promise.all loop)
    // Note: RPC function will be available after running migration 1024_teacher_salary_summary_rpc.sql
    // For now, fallback to existing logic if RPC fails
    let summaries: any[] = [];
    
    try {
      const { data: summariesData, error: rpcError } = await adminSupabase.rpc('get_teacher_salary_summaries', {
        p_school_id: user.schoolId,
        p_teacher_ids: teacherIds.length > 0 ? teacherIds : null
      });

      if (!rpcError && summariesData) {
        // Transform RPC response to match existing format
        summaries = summariesData.map((s: any) => ({
          teacher: s.teacher,
          total_salary_due: s.total_salary_due || 0,
          total_salary_paid: s.total_salary_paid || 0,
          pending_salary: s.pending_salary || 0,
          current_structure: s.current_structure,
          salary_structures: s.salary_structures || []
        }));
      } else {
        // Fallback to existing Promise.all logic if RPC not available
        throw new Error('RPC not available, using fallback');
      }
    } catch (rpcFallbackError) {
      // Fallback to existing logic (for backward compatibility)
      console.warn('[salary/summary] RPC not available, using fallback:', rpcFallbackError);
      summaries = await Promise.all(
        teacherIds.map(async (tid) => {
          // Get teacher info
          const { data: teacher } = await adminSupabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', tid)
            .single();

          // Calculate totals using database functions
          const { data: dueData } = await adminSupabase.rpc('calculate_teacher_salary_due', {
            p_teacher_id: tid,
            p_school_id: user.schoolId,
            p_as_of_date: new Date().toISOString().split('T')[0]
          });
          const total_due = parseFloat(String(dueData || 0));

          const { data: paidData } = await adminSupabase.rpc('calculate_teacher_salary_paid', {
            p_teacher_id: tid,
            p_school_id: user.schoolId,
            p_as_of_date: new Date().toISOString().split('T')[0]
          });
          const total_paid = parseFloat(String(paidData || 0));

          const pending = total_due - total_paid;

          // Get active salary structure
          const { data: structure } = await adminSupabase
            .from('teacher_salary_structure')
            .select('id, teacher_id, base_salary, hra, other_allowances, fixed_deductions, salary_cycle, attendance_based_deduction, effective_from, effective_to, is_active')
            .eq('teacher_id', tid)
            .eq('school_id', user.schoolId)
            .eq('is_active', true)
            .is('effective_to', null)
            .order('effective_from', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get all salary structures (for history) - limit to recent 10
          const { data: structures } = await adminSupabase
            .from('teacher_salary_structure')
            .select('id, teacher_id, base_salary, hra, other_allowances, fixed_deductions, salary_cycle, attendance_based_deduction, effective_from, effective_to, is_active')
            .eq('teacher_id', tid)
            .eq('school_id', user.schoolId)
            .order('effective_from', { ascending: false })
            .limit(10);

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
    }

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

// ============================================
// Get Unpaid Teacher Salaries (Month-wise)
// ============================================
// Shows all unpaid salary months for teachers, including months without salary records
// Accessible to Principal and Clerk
// IMPORTANT: All queries in this endpoint MUST filter by user.schoolId to ensure
// principals/clerks only see data from their own school
router.get('/unpaid', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  // Use user-context Supabase client to enforce RLS
  // The views (teacher_unpaid_salary_months, unpaid_teachers_summary) respect RLS from underlying tables

  try {
    const { teacher_id, time_scope } = req.query;
    const unpaidPageNum = parseInt(req.query.page as string) || 1;
    const unpaidLimitNum = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    // Validate time scope
    const validTimeScopes = ['last_month', 'last_2_months', 'last_3_months', 'last_6_months', 'last_12_months', 'current_academic_year'];
    const timeScope = (time_scope as string) || 'last_12_months';
    
    if (!validTimeScopes.includes(timeScope)) {
      return res.status(400).json({ error: 'Invalid time scope' });
    }

    // Calculate date range based on time scope
    const today = new Date();
    let startDate: Date;
    let endDate: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    switch (timeScope) {
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        break;
      case 'last_2_months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        break;
      case 'last_3_months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        break;
      case 'last_6_months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
        break;
      case 'last_12_months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
        break;
      case 'current_academic_year':
        // Assume academic year starts in April (month 3)
        const currentMonth = today.getMonth();
        const academicYearStart = currentMonth >= 3 
          ? new Date(today.getFullYear(), 3, 1)  // April of current year
          : new Date(today.getFullYear() - 1, 3, 1); // April of previous year
        startDate = academicYearStart;
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth() - 12, 1);
    }

    // Build query for unpaid salary months
    // RLS automatically filters by school_id - no need to manually filter
    // The view respects RLS from underlying tables (profiles, teacher_salary_structure, etc.)
    // Add pagination (critical for 1M+ users)
    const page = unpaidPageNum;
    const limit = unpaidLimitNum;
    const offset = (page - 1) * limit;

    let unpaidMonthsQuery = adminSupabase
      .from('teacher_unpaid_salary_months')
      .select('teacher_id, year, month, period_start, period_end, salary_due, salary_paid, unpaid_amount, is_unpaid', { count: 'exact' })
      .eq('is_unpaid', true)
      .gte('period_start', startDate.toISOString().split('T')[0])
      .lte('period_start', endDate.toISOString().split('T')[0])
      .order('teacher_id', { ascending: true })
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by teacher if provided
    if (teacher_id) {
      unpaidMonthsQuery = unpaidMonthsQuery.eq('teacher_id', teacher_id as string);
    }

    const { data: unpaidMonths, error: unpaidMonthsError, count } = await unpaidMonthsQuery;

    if (unpaidMonthsError) {
      console.error('[salary/unpaid] Error fetching unpaid months:', unpaidMonthsError);
      return res.status(500).json({ error: unpaidMonthsError.message });
    }

    // Get summary of unpaid teachers (only needed fields)
    // RLS automatically filters by school_id - no need to manually filter
    let summaryQuery = supabase
      .from('unpaid_teachers_summary')
      .select('teacher_id, teacher_name, total_unpaid_amount, unpaid_months_count')
      .order('total_unpaid_amount', { ascending: false });

    if (teacher_id) {
      summaryQuery = summaryQuery.eq('teacher_id', teacher_id as string);
    }

    const { data: unpaidTeachersSummary, error: summaryError } = await summaryQuery;

    if (summaryError) {
      console.error('[salary/unpaid] Error fetching summary:', summaryError);
      return res.status(500).json({ error: summaryError.message });
    }

    // Group unpaid months by teacher
    const teacherMonthsMap = new Map<string, any[]>();
    (unpaidMonths || []).forEach((month: any) => {
      if (!teacherMonthsMap.has(month.teacher_id)) {
        teacherMonthsMap.set(month.teacher_id, []);
      }
      teacherMonthsMap.get(month.teacher_id)!.push(month);
    });

    // Build response with teacher details and month-wise breakdown
    const teachersList = Array.from(teacherMonthsMap.entries()).map(([teacherId, months]) => {
      const summary = (unpaidTeachersSummary || []).find((s: any) => s.teacher_id === teacherId);
      
      // Sort months by year and month (descending - newest first)
      const sortedMonths = [...months].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      
      const totalUnpaid = months.reduce((sum, m) => sum + parseFloat(m.pending_amount || 0), 0);
      const oldestMonth = sortedMonths.length > 0 
        ? sortedMonths[sortedMonths.length - 1] 
        : null;
      const latestMonth = sortedMonths.length > 0 
        ? sortedMonths[0] 
        : null;

      return {
        teacher_id: teacherId,
        teacher_name: months[0]?.teacher_name || summary?.teacher_name || 'Unknown',
        teacher_email: months[0]?.teacher_email || summary?.teacher_email || '',
        unpaid_months_count: months.length,
        total_unpaid_amount: totalUnpaid,
        max_days_unpaid: oldestMonth ? oldestMonth.days_since_period_start : 0,
        oldest_unpaid_month: oldestMonth ? {
          month: oldestMonth.month,
          year: oldestMonth.year,
          period_label: oldestMonth.period_label,
          period_start: oldestMonth.period_start,
          days_since_period_start: oldestMonth.days_since_period_start
        } : null,
        latest_unpaid_month: latestMonth ? {
          month: latestMonth.month,
          year: latestMonth.year,
          period_label: latestMonth.period_label,
          period_start: latestMonth.period_start,
          days_since_period_start: latestMonth.days_since_period_start
        } : null,
        unpaid_months: sortedMonths.map((m: any) => ({
          month: m.month,
          year: m.year,
          period_start: m.period_start,
          period_label: m.period_label,
          payment_status: m.payment_status,
          net_salary: parseFloat(m.net_salary || 0),
          paid_amount: parseFloat(m.paid_amount || 0),
          credit_applied: parseFloat(m.credit_applied || 0),
          effective_paid_amount: parseFloat(m.effective_paid_amount || 0),
          pending_amount: parseFloat(m.pending_amount || 0),
          days_since_period_start: m.days_since_period_start,
          payment_date: m.payment_date
        }))
      };
    });

    // Calculate totals
    const totalTeachers = teachersList.length;
    const totalUnpaidAmount = teachersList.reduce((sum, t) => sum + t.total_unpaid_amount, 0);
    const totalUnpaidMonths = teachersList.reduce((sum, t) => sum + t.unpaid_months_count, 0);

    // Pagination
    const summaryPageNum = parseInt(String(page)) || 1;
    const summaryLimitNum = parseInt(String(limit)) || 20;
    const startIndex = (summaryPageNum - 1) * summaryLimitNum;
    const endIndex = startIndex + summaryLimitNum;
    const paginatedTeachers = teachersList.slice(startIndex, endIndex);

    return res.json({
      summary: {
        total_teachers: totalTeachers,
        total_unpaid_amount: totalUnpaidAmount,
        total_unpaid_months: totalUnpaidMonths,
        time_scope: timeScope,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      },
      teachers: paginatedTeachers,
      pagination: {
        page: summaryPageNum,
        limit: summaryLimitNum,
        total: teachersList.length,
        total_pages: Math.ceil(teachersList.length / summaryLimitNum)
      }
    });
  } catch (err: any) {
    console.error('[salary/unpaid] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get unpaid teacher salaries' });
  }
});

// ============================================
// Get Credit Balance
// ============================================
// Returns available credit balance for a teacher
router.get('/credits/:teacherId', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacherId } = req.params;

  // Teachers can only see their own credits
  if (user.role === 'teacher' && user.id !== teacherId) {
    return res.status(403).json({ error: 'Access denied' });
  }



  try {
    // Verify teacher belongs to the school
    const { data: teacher, error: teacherError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', teacherId)
      .eq('school_id', user.schoolId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Get credit balance
    const { data: creditBalance, error: creditError } = await adminSupabase.rpc(
      'get_teacher_credit_balance',
      {
        p_teacher_id: teacherId,
        p_school_id: user.schoolId
      }
    );

    if (creditError) {
      console.error('[salary/credits] Error fetching credit balance:', creditError);
      return res.status(400).json({ error: creditError.message });
    }

    // Get credit details
    const { data: credits, error: creditsError } = await adminSupabase
      .from('teacher_salary_credits')
      .select(`
        *,
        applications:teacher_salary_credit_applications(
          id,
          applied_amount,
          applied_to_month,
          applied_to_year,
          created_at
        )
      `)
      .eq('teacher_id', teacherId)
      .eq('school_id', user.schoolId)
      .order('created_at', { ascending: false });

    if (creditsError) {
      console.error('[salary/credits] Error fetching credit details:', creditsError);
    }

    return res.json({
      teacher_id: teacherId,
      available_credit: parseFloat(String(creditBalance || 0)),
      credits: credits || []
    });
  } catch (err: any) {
    console.error('[salary/credits] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ============================================
// Get Comprehensive Payment History
// ============================================
// Returns complete payment history with summary, running totals, and all details
router.get('/history/:teacherId', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacherId } = req.params;
  const { start_date, end_date, payment_type, payment_mode, page = '1', limit = '50' } = req.query;

  // Teachers can only see their own history
  if (user.role === 'teacher' && user.id !== teacherId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own payment history.' });
  }

  try {
    // Verify teacher belongs to the school using user-context client (RLS enforced)
    const { data: teacher, error: teacherError } = await supabase
      .from('profiles')
      .select('id, full_name, email, school_id, role')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .maybeSingle();

    if (teacherError) {
      console.error('[salary/history] Error fetching teacher:', teacherError);
      return res.status(400).json({ error: teacherError.message });
    }

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Verify teacher belongs to user's school (RLS should enforce this, but double-check)
    if (teacher.school_id !== user.schoolId) {
      return res.status(403).json({ error: 'Access denied. Teacher does not belong to your school.' });
    }

    // Build query for payment history
    // RLS automatically filters by school_id - no need to manually filter
    let query = supabase
      .from('teacher_payment_history')
      .select('*')
      .eq('teacher_id', teacherId);

    // Apply filters
    if (start_date) {
      query = query.gte('payment_date', start_date);
    }
    if (end_date) {
      query = query.lte('payment_date', end_date);
    }
    if (payment_type) {
      query = query.eq('payment_type', payment_type);
    }
    if (payment_mode) {
      query = query.eq('payment_mode', payment_mode);
    }

    // Get total count for pagination (using a separate count query)
    // RLS automatically filters by school_id
    const countQuery = supabase
      .from('teacher_payment_history')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId);
    
    if (start_date) {
      countQuery.gte('payment_date', start_date);
    }
    if (end_date) {
      countQuery.lte('payment_date', end_date);
    }
    if (payment_type) {
      countQuery.eq('payment_type', payment_type);
    }
    if (payment_mode) {
      countQuery.eq('payment_mode', payment_mode);
    }

    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('[salary/history] Error counting payments:', countError);
    }

    // Apply pagination
    const historyPageNum = parseInt(page as string, 10);
    const historyLimitNum = parseInt(limit as string, 10);
    const offset = (historyPageNum - 1) * historyLimitNum;

    const { data: payments, error: paymentsError } = await query
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + historyLimitNum - 1);

    if (paymentsError) {
      console.error('[salary/history] Error fetching payment history:', paymentsError);
      return res.status(400).json({ error: paymentsError.message });
    }

    // Get payment summary using the database function
    // Note: RPC functions may need service role if they're SECURITY DEFINER
    // For now, we'll use service role only for this RPC call (documented exception)
    
    const { data: summary, error: summaryError } = await adminSupabase.rpc(
      'get_teacher_payment_summary',
      {
        p_teacher_id: teacherId,
        p_school_id: user.schoolId,
        p_start_date: start_date || null,
        p_end_date: end_date || null
      }
    );

    if (summaryError) {
      console.error('[salary/history] Error fetching payment summary:', summaryError);
      // Don't fail the request, just log the error
    }

    // Get current pending amount (from unpaid salaries view)
    // Use user-context client - RLS automatically filters by school_id
    let pendingAmount = 0;
    try {
      const { data: unpaidData, error: unpaidError } = await supabase
        .from('teacher_unpaid_salary_months')
        .select('pending_amount')
        .eq('teacher_id', teacherId)
        .eq('payment_status', 'unpaid')
        .maybeSingle();

      if (!unpaidError && unpaidData) {
        pendingAmount = parseFloat(String(unpaidData.pending_amount || 0));
      }
    } catch (err) {
      // Ignore errors for pending amount calculation
      console.error('[salary/history] Error fetching pending amount:', err);
    }

    return res.json({
      teacher: {
        id: teacher.id,
        full_name: teacher.full_name,
        email: teacher.email
      },
      summary: {
        ...summary,
        pending_amount: pendingAmount,
        total_paid_till_date: parseFloat(String(summary?.total_paid || 0))
      },
      payments: payments || [],
      pagination: {
        page: historyPageNum,
        limit: historyLimitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / historyLimitNum)
      }
    });
  } catch (err: any) {
    console.error('[salary/history] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

