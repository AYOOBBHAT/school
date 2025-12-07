import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// ============================================
// STUDENT FEE STRUCTURE - Load Fee Components
// ============================================

// Get student's fee structure with monthly tracking
router.get('/students/:studentId/fee-structure', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  const { studentId } = req.params;

  try {
    // Verify student belongs to school
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id, class_group_id, admission_date, profile:profiles!students_profile_id_fkey(full_name)')
      .eq('id', studentId)
      .eq('school_id', user.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get all monthly fee components for this student
    const { data: monthlyComponents, error: componentsError } = await adminSupabase
      .from('monthly_fee_components')
      .select(`
        *,
        fee_category:fee_categories(id, name, fee_type),
        transport_route:transport_routes(id, route_name)
      `)
      .eq('student_id', studentId)
      .eq('school_id', user.schoolId)
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true });

    if (componentsError) {
      return res.status(400).json({ error: componentsError.message });
    }

    // Check if monthly components exist, if not we may need to generate them
    if (!monthlyComponents || monthlyComponents.length === 0) {
      return res.json({
        student,
        monthlyComponents: [],
        message: 'No fee structure assigned. Principal needs to configure fees for this student.'
      });
    }

    return res.json({
      student,
      monthlyComponents: monthlyComponents || []
    });
  } catch (err: any) {
    console.error('[get-fee-structure] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get fee structure' });
  }
});

// ============================================
// GENERATE MONTHLY FEE COMPONENTS
// ============================================

const generateMonthlyComponentsSchema = Joi.object({
  student_id: Joi.string().uuid().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required()
});

// Generate monthly fee components for a student
router.post('/generate-monthly-components', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = generateMonthlyComponentsSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { student_id, start_date, end_date } = value;

    // Get student details
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id, class_group_id, admission_date')
      .eq('id', student_id)
      .eq('school_id', user.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get class fee defaults
    const { data: classFees } = await adminSupabase
      .from('class_fee_defaults')
      .select('*, fee_category:fee_categories(*)')
      .eq('class_group_id', student.class_group_id)
      .eq('school_id', user.schoolId)
      .eq('is_active', true);

    // Get student transport assignment
    const { data: transportAssignment } = await adminSupabase
      .from('student_transport')
      .select('*, route:transport_routes(*), fee:transport_fees(*)')
      .eq('student_id', student_id)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .maybeSingle();

    // Get student custom fees
    const { data: customFees } = await adminSupabase
      .from('student_custom_fees')
      .select('*, fee_category:fee_categories(*)')
      .eq('student_id', student_id)
      .eq('school_id', user.schoolId)
      .eq('is_active', true);

    // Generate monthly components
    const monthlyComponents: any[] = [];
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);

    let currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);

      // Add class fees
      if (classFees) {
        for (const classFee of classFees) {
          if (classFee.fee_cycle === 'monthly' || classFee.fee_cycle === 'quarterly' || classFee.fee_cycle === 'yearly') {
            monthlyComponents.push({
              student_id,
              school_id: user.schoolId,
              fee_category_id: classFee.fee_category_id,
              fee_type: 'class-fee',
              fee_name: classFee.fee_category?.name || 'Class Fee',
              period_year: year,
              period_month: month,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
              fee_amount: parseFloat(classFee.amount),
              fee_cycle: classFee.fee_cycle,
              due_date: new Date(year, month - 1, 10).toISOString().split('T')[0], // 10th of each month
              pending_amount: parseFloat(classFee.amount),
              status: 'pending'
            });
          }
        }
      }

      // Add transport fee
      if (transportAssignment && transportAssignment.fee) {
        const totalTransportFee = parseFloat(transportAssignment.fee.base_fee || 0) +
          parseFloat(transportAssignment.fee.escort_fee || 0) +
          parseFloat(transportAssignment.fee.fuel_surcharge || 0);

        monthlyComponents.push({
          student_id,
          school_id: user.schoolId,
          fee_category_id: null,
          fee_type: 'transport-fee',
          fee_name: `Transport - ${transportAssignment.route?.route_name || 'N/A'}`,
          period_year: year,
          period_month: month,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          fee_amount: totalTransportFee,
          fee_cycle: transportAssignment.fee.fee_cycle || 'monthly',
          transport_route_id: transportAssignment.route_id,
          transport_route_name: transportAssignment.route?.route_name,
          due_date: new Date(year, month - 1, 10).toISOString().split('T')[0],
          pending_amount: totalTransportFee,
          status: 'pending'
        });
      }

      // Add custom fees
      if (customFees) {
        for (const customFee of customFees) {
          if (customFee.fee_cycle === 'monthly' || customFee.fee_cycle === 'quarterly' || customFee.fee_cycle === 'yearly') {
            monthlyComponents.push({
              student_id,
              school_id: user.schoolId,
              fee_category_id: customFee.fee_category_id,
              fee_type: 'custom-fee',
              fee_name: customFee.fee_category?.name || 'Custom Fee',
              period_year: year,
              period_month: month,
              period_start: periodStart.toISOString().split('T')[0],
              period_end: periodEnd.toISOString().split('T')[0],
              fee_amount: parseFloat(customFee.amount),
              fee_cycle: customFee.fee_cycle,
              due_date: new Date(year, month - 1, 10).toISOString().split('T')[0],
              pending_amount: parseFloat(customFee.amount),
              status: 'pending'
            });
          }
        }
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Insert monthly components (use upsert to avoid duplicates)
    if (monthlyComponents.length > 0) {
      const { data: inserted, error: insertError } = await adminSupabase
        .from('monthly_fee_components')
        .upsert(monthlyComponents, {
          onConflict: 'student_id,fee_category_id,period_year,period_month,fee_type',
          ignoreDuplicates: false
        })
        .select();

      if (insertError) {
        return res.status(400).json({ error: insertError.message });
      }

      return res.json({
        success: true,
        message: 'Monthly fee components generated successfully',
        components: inserted
      });
    }

    return res.json({
      success: true,
      message: 'No fee components to generate',
      components: []
    });
  } catch (err: any) {
    console.error('[generate-monthly-components] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate monthly components' });
  }
});

// ============================================
// FEE PAYMENT RECORDING
// ============================================

const recordPaymentSchema = Joi.object({
  monthly_fee_component_id: Joi.string().uuid().required(),
  payment_amount: Joi.number().min(0.01).required(),
  payment_date: Joi.date().default(() => new Date()),
  payment_mode: Joi.string().valid('cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer').required(),
  transaction_id: Joi.string().allow('', null).optional(),
  cheque_number: Joi.string().allow('', null).optional(),
  bank_name: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional()
});

// Record a payment against a monthly fee component
router.post('/record-payment', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = recordPaymentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get the monthly fee component
    const { data: component, error: componentError } = await adminSupabase
      .from('monthly_fee_components')
      .select('*')
      .eq('id', value.monthly_fee_component_id)
      .eq('school_id', user.schoolId)
      .single();

    if (componentError || !component) {
      return res.status(404).json({ error: 'Fee component not found' });
    }

    // Generate receipt number
    const { data: receiptNumber } = await adminSupabase
      .rpc('generate_receipt_number', { school_uuid: user.schoolId });

    // Record payment
    const paymentData = {
      monthly_fee_component_id: value.monthly_fee_component_id,
      student_id: component.student_id,
      school_id: user.schoolId,
      payment_amount: value.payment_amount,
      payment_date: value.payment_date,
      payment_mode: value.payment_mode,
      transaction_id: value.transaction_id,
      cheque_number: value.cheque_number,
      bank_name: value.bank_name,
      received_by: user.id,
      receipt_number: receiptNumber || `RCP-${Date.now()}`,
      notes: value.notes
    };

    const { data: payment, error: paymentError } = await adminSupabase
      .from('monthly_fee_payments')
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      return res.status(400).json({ error: paymentError.message });
    }

    // The trigger will automatically update the monthly_fee_component status
    // Fetch updated component
    const { data: updatedComponent } = await adminSupabase
      .from('monthly_fee_components')
      .select('*')
      .eq('id', value.monthly_fee_component_id)
      .single();

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment,
      component: updatedComponent,
      receipt_number: paymentData.receipt_number
    });
  } catch (err: any) {
    console.error('[record-payment] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to record payment' });
  }
});

// ============================================
// PAYMENT HISTORY
// ============================================

// Get payment history for a student
router.get('/students/:studentId/payment-history', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  const { studentId } = req.params;
  const { year, month } = req.query;

  try {
    let query = adminSupabase
      .from('monthly_fee_payments')
      .select(`
        *,
        component:monthly_fee_components(*),
        received_by_profile:profiles!monthly_fee_payments_received_by_fkey(full_name, email)
      `)
      .eq('student_id', studentId)
      .eq('school_id', user.schoolId)
      .order('payment_date', { ascending: false });

    if (year) {
      query = query.gte('payment_date', `${year}-01-01`);
      query = query.lte('payment_date', `${year}-12-31`);
    }

    const { data: payments, error: paymentsError } = await query;

    if (paymentsError) {
      return res.status(400).json({ error: paymentsError.message });
    }

    return res.json({
      payments: payments || []
    });
  } catch (err: any) {
    console.error('[payment-history] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get payment history' });
  }
});

// ============================================
// RECEIPT GENERATION
// ============================================

// Get receipt details
router.get('/receipts/:receiptNumber', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  const { receiptNumber } = req.params;

  try {
    // Get payment with receipt number
    const { data: payment, error: paymentError } = await adminSupabase
      .from('monthly_fee_payments')
      .select(`
        *,
        student:students(
          id,
          roll_number,
          profile:profiles!students_profile_id_fkey(full_name, email),
          class:class_groups(name)
        ),
        component:monthly_fee_components(*),
        received_by_profile:profiles!monthly_fee_payments_received_by_fkey(full_name, email)
      `)
      .eq('receipt_number', receiptNumber)
      .eq('school_id', user.schoolId)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Get school details
    const { data: school } = await adminSupabase
      .from('schools')
      .select('*')
      .eq('id', user.schoolId)
      .single();

    return res.json({
      receipt: payment,
      school
    });
  } catch (err: any) {
    console.error('[get-receipt] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get receipt' });
  }
});

// ============================================
// PENDING & OVERDUE FEES
// ============================================

// Get pending fees for a student
router.get('/students/:studentId/pending-fees', requireRoles(['principal', 'clerk', 'student', 'parent']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  const { studentId } = req.params;

  try {
    const { data: pendingFees, error: feesError } = await adminSupabase
      .from('monthly_fee_components')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', user.schoolId)
      .in('status', ['pending', 'partially-paid', 'overdue'])
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true });

    if (feesError) {
      return res.status(400).json({ error: feesError.message });
    }

    // Calculate totals
    const totalPending = (pendingFees || []).reduce((sum: number, fee: any) => {
      return sum + parseFloat(fee.pending_amount || 0);
    }, 0);

    const overdueCount = (pendingFees || []).filter((fee: any) => fee.status === 'overdue').length;

    return res.json({
      pendingFees: pendingFees || [],
      totalPending,
      overdueCount
    });
  } catch (err: any) {
    console.error('[pending-fees] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get pending fees' });
  }
});

// ============================================
// DASHBOARD STATS
// ============================================

// Get fee collection stats for clerk dashboard
router.get('/stats', requireRoles(['principal', 'clerk']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get today's collections
    const today = new Date().toISOString().split('T')[0];
    const { data: todayPayments } = await adminSupabase
      .from('monthly_fee_payments')
      .select('payment_amount')
      .eq('school_id', user.schoolId)
      .gte('payment_date', today);

    const todayTotal = (todayPayments || []).reduce((sum: number, p: any) => sum + parseFloat(p.payment_amount || 0), 0);

    // Get this month's collections
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const { data: monthPayments } = await adminSupabase
      .from('monthly_fee_payments')
      .select('payment_amount')
      .eq('school_id', user.schoolId)
      .gte('payment_date', monthStart);

    const monthTotal = (monthPayments || []).reduce((sum: number, p: any) => sum + parseFloat(p.payment_amount || 0), 0);

    // Get pending amount
    const { data: pendingComponents } = await adminSupabase
      .from('monthly_fee_components')
      .select('pending_amount')
      .eq('school_id', user.schoolId)
      .in('status', ['pending', 'partially-paid', 'overdue']);

    const totalPending = (pendingComponents || []).reduce((sum: number, c: any) => sum + parseFloat(c.pending_amount || 0), 0);

    // Get overdue count
    const { count: overdueCount } = await adminSupabase
      .from('monthly_fee_components')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', user.schoolId)
      .eq('status', 'overdue');

    return res.json({
      todayTotal,
      monthTotal,
      totalPending,
      overdueCount: overdueCount || 0
    });
  } catch (err: any) {
    console.error('[stats] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get stats' });
  }
});

export default router;
