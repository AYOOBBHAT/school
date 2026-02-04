import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';

const router = Router();

// ======================================================
// GET /api/students/fees - Get fee summary
// ======================================================
router.get('/', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    // Get student record from profile_id
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id')
      .eq('profile_id', user.id)
      .eq('school_id', user.schoolId)
      .maybeSingle();

    if (studentError) {
      console.error('[studentFees] Error fetching student:', studentError);
      return res.status(400).json({ error: studentError.message });
    }

    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Get fee summary from view
    const { data: summary, error: summaryError } = await adminSupabase
      .from('student_fee_summary')
      .select('*')
      .eq('student_id', student.id)
      .single();

    if (summaryError) {
      console.error('[studentFees] Error fetching summary:', summaryError);
      // If view returns no data, return zeros
      return res.json({
        summary: {
          student_id: student.id,
          total_fee: 0,
          paid_amount: 0,
          pending_amount: 0
        },
        bills: [],
        payments: []
      });
    }

    // Get bills
    const { data: bills, error: billsError } = await adminSupabase
      .from('fee_bills')
      .select('*')
      .eq('student_id', student.id)
      .eq('school_id', user.schoolId)
      .order('created_at', { ascending: false });

    if (billsError) {
      console.error('[studentFees] Error fetching bills:', billsError);
      return res.status(400).json({ error: billsError.message });
    }

    // Get payments
    const { data: payments, error: paymentsError } = await adminSupabase
      .from('fee_payments')
      .select('*')
      .eq('student_id', student.id)
      .eq('school_id', user.schoolId)
      .order('payment_date', { ascending: false });

    if (paymentsError) {
      console.error('[studentFees] Error fetching payments:', paymentsError);
      return res.status(400).json({ error: paymentsError.message });
    }

    return res.json({
      summary: summary || {
        student_id: student.id,
        total_fee: 0,
        paid_amount: 0,
        pending_amount: 0
      },
      bills: bills || [],
      payments: payments || []
    });
  } catch (err: any) {
    console.error('[studentFees] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ======================================================
// GET /api/students/fees/bills - Get bills only
// ======================================================
router.get('/bills', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    // Get student record from profile_id
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .eq('school_id', user.schoolId)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Get bills
    const { data: bills, error: billsError } = await adminSupabase
      .from('fee_bills')
      .select('*')
      .eq('student_id', student.id)
      .eq('school_id', user.schoolId)
      .order('created_at', { ascending: false });

    if (billsError) {
      console.error('[studentFees/bills] Error:', billsError);
      return res.status(400).json({ error: billsError.message });
    }

    return res.json({ bills: bills || [] });
  } catch (err: any) {
    console.error('[studentFees/bills] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ======================================================
// GET /api/students/fees/payments - Get payments only
// ======================================================
router.get('/payments', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    // Get student record from profile_id
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .eq('school_id', user.schoolId)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Get payments
    const { data: payments, error: paymentsError } = await adminSupabase
      .from('fee_payments')
      .select('*')
      .eq('student_id', student.id)
      .eq('school_id', user.schoolId)
      .order('payment_date', { ascending: false });

    if (paymentsError) {
      console.error('[studentFees/payments] Error:', paymentsError);
      return res.status(400).json({ error: paymentsError.message });
    }

    return res.json({ payments: payments || [] });
  } catch (err: any) {
    console.error('[studentFees/payments] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
