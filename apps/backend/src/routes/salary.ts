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
  attendance_based_deduction: Joi.boolean().default(false)
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

// Create or Update Teacher Salary Structure
router.post('/structure', requireRoles(['principal', 'clerk']), async (req, res) => {
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

    // Check if structure already exists
    const { data: existing } = await adminSupabase
      .from('teacher_salary_structure')
      .select('id')
      .eq('teacher_id', value.teacher_id)
      .single();

    let result;
    if (existing) {
      // Update existing structure
      const { data, error: updateError } = await adminSupabase
        .from('teacher_salary_structure')
        .update({
          base_salary: value.base_salary,
          hra: value.hra,
          other_allowances: value.other_allowances,
          fixed_deductions: value.fixed_deductions,
          salary_cycle: value.salary_cycle,
          attendance_based_deduction: value.attendance_based_deduction,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[salary] Error updating structure:', updateError);
        return res.status(400).json({ error: updateError.message });
      }
      result = data;
    } else {
      // Create new structure
      const { data, error: insertError } = await adminSupabase
        .from('teacher_salary_structure')
        .insert({
          teacher_id: value.teacher_id,
          school_id: user.schoolId,
          base_salary: value.base_salary,
          hra: value.hra,
          other_allowances: value.other_allowances,
          fixed_deductions: value.fixed_deductions,
          salary_cycle: value.salary_cycle,
          attendance_based_deduction: value.attendance_based_deduction
        })
        .select()
        .single();

      if (insertError) {
        console.error('[salary] Error creating structure:', insertError);
        return res.status(400).json({ error: insertError.message });
      }
      result = data;
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
      .single();

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

// Generate Monthly Salary
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

    // Get salary structure
    const { data: structure, error: structureError } = await adminSupabase
      .from('teacher_salary_structure')
      .select('*')
      .eq('teacher_id', value.teacher_id)
      .eq('school_id', user.schoolId)
      .single();

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

    // Create salary record
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
        status: 'pending'
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
    if (status) query = query.eq('status', status as string);

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

// Approve Salary Record
router.put('/records/:recordId/approve', requireRoles(['principal', 'clerk']), async (req, res) => {
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

    // Update record
    const { data: updated, error: updateError } = await adminSupabase
      .from('teacher_salary_records')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
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

// Mark Salary as Paid
router.put('/records/:recordId/mark-paid', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = updateSalaryRecordSchema.validate(req.body);
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

    if (record.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved salaries can be marked as paid' });
    }

    // Update record
    const updateData: any = {
      status: 'paid',
      payment_date: value.payment_date || new Date().toISOString().split('T')[0]
    };
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

export default router;

