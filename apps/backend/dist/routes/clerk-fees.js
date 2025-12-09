import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
import { loadAssignedFeeStructure, getMonthlyFeeLedger, ensureMonthlyFeeComponentsExist } from '../utils/clerkFeeCollection.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// ============================================
// 1. Get Assigned Fee Structure for Student
// ============================================
router.get('/student/:studentId/fee-structure', requireRoles(['clerk', 'principal']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { studentId } = req.params;
    try {
        // Verify student belongs to school
        const { data: student, error: studentError } = await adminSupabase
            .from('students')
            .select('id, school_id, profile:profiles!students_profile_id_fkey(full_name), roll_number, class_groups:class_group_id(name)')
            .eq('id', studentId)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student not found or access denied' });
        }
        // Handle Supabase join result (can be object or array)
        const profileData = Array.isArray(student.profile) ? student.profile[0] : student.profile;
        const classGroupData = Array.isArray(student.class_groups) ? student.class_groups[0] : student.class_groups;
        // Load assigned fee structure
        const feeStructure = await loadAssignedFeeStructure(studentId, user.schoolId, adminSupabase);
        // Check if no fee configured
        if (!feeStructure.class_fee && !feeStructure.transport_fee && feeStructure.custom_fees.length === 0) {
            return res.json({
                student: {
                    id: student.id,
                    name: profileData?.full_name || null,
                    roll_number: student.roll_number || null,
                    class: classGroupData?.name || null
                },
                fee_structure: null,
                message: 'No fee configured for this student'
            });
        }
        // Ensure monthly components exist
        await ensureMonthlyFeeComponentsExist(studentId, user.schoolId, adminSupabase);
        // Get monthly ledger
        const monthlyLedger = await getMonthlyFeeLedger(studentId, user.schoolId, adminSupabase);
        return res.json({
            student: {
                id: student.id,
                name: profileData?.full_name || null,
                roll_number: student.roll_number || null,
                class: classGroupData?.name || null
            },
            fee_structure: feeStructure,
            monthly_ledger: monthlyLedger
        });
    }
    catch (err) {
        console.error('[clerk-fees/fee-structure] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to load fee structure' });
    }
});
// ============================================
// 2. Get Monthly Fee Status Ledger (Month-by-Month View)
// ============================================
router.get('/student/:studentId/monthly-ledger', requireRoles(['clerk', 'principal', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { studentId } = req.params;
    const startYear = req.query.start_year ? parseInt(req.query.start_year) : undefined;
    const endYear = req.query.end_year ? parseInt(req.query.end_year) : undefined;
    try {
        // Verify student belongs to school (or is the student/parent themselves)
        if (user.role === 'student' || user.role === 'parent') {
            // Additional check for students/parents
            const { data: studentCheck } = await adminSupabase
                .from('students')
                .select('id, profile_id')
                .eq('id', studentId)
                .eq('school_id', user.schoolId)
                .single();
            if (!studentCheck) {
                return res.status(404).json({ error: 'Student not found or access denied' });
            }
            if (user.role === 'student' && studentCheck.profile_id !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (user.role === 'parent') {
                // Check if user is a guardian
                const { data: guardian } = await adminSupabase
                    .from('student_guardians')
                    .select('id')
                    .eq('student_id', studentId)
                    .eq('guardian_profile_id', user.id)
                    .single();
                if (!guardian) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
        }
        // Ensure monthly components exist
        await ensureMonthlyFeeComponentsExist(studentId, user.schoolId, adminSupabase);
        // Get monthly ledger
        const monthlyLedger = await getMonthlyFeeLedger(studentId, user.schoolId, adminSupabase, startYear, endYear);
        return res.json({
            student_id: studentId,
            monthly_ledger: monthlyLedger
        });
    }
    catch (err) {
        console.error('[clerk-fees/monthly-ledger] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get monthly ledger' });
    }
});
// ============================================
// 3. Record Fee Payment (Collect Fees)
// ============================================
const collectPaymentSchema = Joi.object({
    monthly_fee_component_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
    payment_amount: Joi.number().positive().required(),
    payment_date: Joi.date().optional().default(() => new Date()),
    payment_mode: Joi.string().valid('cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer').required(),
    transaction_id: Joi.string().allow('', null).optional(),
    cheque_number: Joi.string().allow('', null).optional(),
    bank_name: Joi.string().allow('', null).optional(),
    notes: Joi.string().allow('', null).optional()
});
router.post('/collect', requireRoles(['clerk', 'principal']), async (req, res) => {
    const { error, value } = collectPaymentSchema.validate(req.body);
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
        const { monthly_fee_component_ids, payment_amount, payment_date, payment_mode, transaction_id, cheque_number, bank_name, notes } = value;
        // Get all fee components
        const { data: components, error: componentsError } = await adminSupabase
            .from('monthly_fee_components')
            .select('*')
            .in('id', monthly_fee_component_ids)
            .eq('school_id', user.schoolId);
        if (componentsError || !components || components.length === 0) {
            return res.status(404).json({ error: 'Fee components not found' });
        }
        // Verify all components belong to same student
        const studentIds = [...new Set(components.map((c) => c.student_id))];
        if (studentIds.length !== 1) {
            return res.status(400).json({ error: 'All fee components must belong to the same student' });
        }
        const studentId = studentIds[0];
        // Validate: Prevent payment for future months (unless principal enables advance payments)
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const futureComponents = components.filter((c) => {
            return c.period_year > currentYear ||
                (c.period_year === currentYear && c.period_month > currentMonth);
        });
        if (futureComponents.length > 0) {
            // Check if school allows advance payments (for now, reject by default)
            // TODO: Add school settings table to check allow_advance_payments flag
            const futureMonths = futureComponents.map((c) => `${c.period_month}/${c.period_year}`).join(', ');
            return res.status(400).json({
                error: `Cannot record payment for future months (${futureMonths}). Advance payments require Principal approval. Please contact Principal to enable advance payments.`
            });
        }
        // Verify student belongs to school
        const { data: student } = await adminSupabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('school_id', user.schoolId)
            .single();
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // Calculate total pending amount
        const totalPending = components.reduce((sum, comp) => {
            return sum + parseFloat(comp.pending_amount || 0);
        }, 0);
        // Validate: Payment amount should not exceed pending fee
        if (payment_amount > totalPending) {
            return res.status(400).json({
                error: `Payment amount (₹${payment_amount.toFixed(2)}) cannot exceed total pending amount (₹${totalPending.toFixed(2)})`
            });
        }
        // Validate: Payment amount must be positive
        if (payment_amount <= 0) {
            return res.status(400).json({
                error: `Payment amount must be greater than 0`
            });
        }
        // Generate receipt number
        let receiptNumber;
        try {
            const { data: receiptData, error: receiptError } = await adminSupabase.rpc('generate_receipt_number', {
                school_uuid: user.schoolId
            });
            if (receiptError || !receiptData) {
                // Fallback: manual receipt number generation
                const { count } = await adminSupabase
                    .from('monthly_fee_payments')
                    .select('*', { count: 'exact', head: true })
                    .eq('school_id', user.schoolId)
                    .not('receipt_number', 'is', null);
                const receiptCount = (count || 0) + 1;
                receiptNumber = `RCP-${new Date().getFullYear()}-${String(receiptCount).padStart(6, '0')}`;
            }
            else {
                receiptNumber = receiptData;
            }
        }
        catch (err) {
            // Fallback receipt number
            receiptNumber = `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        }
        // Distribute payment across components (in order of oldest pending first)
        const sortedComponents = [...components].sort((a, b) => {
            const dateA = new Date(`${a.period_year}-${String(a.period_month).padStart(2, '0')}-01`);
            const dateB = new Date(`${b.period_year}-${String(b.period_month).padStart(2, '0')}-01`);
            return dateA.getTime() - dateB.getTime();
        });
        let remainingPayment = payment_amount;
        const payments = [];
        for (const component of sortedComponents) {
            if (remainingPayment <= 0)
                break;
            const pendingAmount = parseFloat(component.pending_amount || 0);
            if (pendingAmount <= 0)
                continue;
            const amountToPay = Math.min(remainingPayment, pendingAmount);
            // Create payment record
            const { data: payment, error: paymentError } = await adminSupabase
                .from('monthly_fee_payments')
                .insert({
                monthly_fee_component_id: component.id,
                student_id: studentId,
                school_id: user.schoolId,
                payment_amount: amountToPay,
                payment_date: payment_date.toISOString().split('T')[0],
                payment_mode: payment_mode,
                transaction_id: transaction_id || null,
                cheque_number: cheque_number || null,
                bank_name: bank_name || null,
                received_by: user.id,
                receipt_number: receiptNumber,
                notes: notes || null
            })
                .select()
                .single();
            if (paymentError) {
                console.error('[clerk-fees/collect] Payment insert error:', paymentError);
                return res.status(500).json({ error: `Failed to record payment: ${paymentError.message}` });
            }
            payments.push(payment);
            remainingPayment -= amountToPay;
        }
        // Check if there's any remaining payment (should not happen with new validation, but keep for safety)
        if (remainingPayment > 0.01) { // Allow small rounding differences (1 paisa)
            console.warn(`[clerk-fees/collect] Warning: Remaining payment ${remainingPayment} after distribution. This should not happen with validation.`);
            // This should not happen with the new validation, but if it does, we'll log it
            // The payment has already been recorded for the selected components
        }
        // Verify that at least one payment was recorded
        if (payments.length === 0) {
            return res.status(500).json({
                error: 'No payment was recorded. Please check that selected components have pending amounts.'
            });
        }
        // Get updated components to return status
        const { data: updatedComponents } = await adminSupabase
            .from('monthly_fee_components')
            .select('*')
            .in('id', monthly_fee_component_ids)
            .eq('school_id', user.schoolId);
        return res.status(201).json({
            success: true,
            receipt_number: receiptNumber,
            payment: {
                id: payments[0]?.id,
                amount_paid: payment_amount,
                payment_amount: payment_amount,
                payment_date: payment_date.toISOString().split('T')[0],
                payment_mode: payment_mode,
                transaction_id: transaction_id || null,
                cheque_number: cheque_number || null,
                bank_name: bank_name || null,
                notes: notes || null,
                receipt_number: receiptNumber
            },
            payments: payments, // Return all payment records created
            components: updatedComponents,
            message: 'Payment recorded successfully'
        });
    }
    catch (err) {
        console.error('[clerk-fees/collect] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to record payment' });
    }
});
// ============================================
// 4. Get Payment Receipt
// ============================================
router.get('/receipt/:paymentId', requireRoles(['clerk', 'principal', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { paymentId } = req.params;
    try {
        // Get payment with all related data
        const { data: payment, error: paymentError } = await adminSupabase
            .from('monthly_fee_payments')
            .select(`
        *,
        monthly_fee_components:monthly_fee_component_id(
          *,
          fee_categories:fee_category_id(id, name)
        ),
        students:student_id(
          id,
          roll_number,
          profile:profiles!students_profile_id_fkey(
            full_name,
            email,
            phone
          ),
          class_groups:class_group_id(name)
        ),
        received_by_profile:profiles!monthly_fee_payments_received_by_fkey(
          full_name
        ),
        schools:school_id(
          id,
          name,
          address,
          phone,
          email
        )
      `)
            .eq('id', paymentId)
            .eq('school_id', user.schoolId)
            .single();
        if (paymentError || !payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        // Verify access for students/parents
        if (user.role === 'student' || user.role === 'parent') {
            const student = payment.students;
            if (user.role === 'student' && student?.profile_id !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (user.role === 'parent') {
                const { data: guardian } = await adminSupabase
                    .from('student_guardians')
                    .select('id')
                    .eq('student_id', student?.id)
                    .eq('guardian_profile_id', user.id)
                    .single();
                if (!guardian) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
        }
        // Format receipt data
        const receipt = {
            receipt_number: payment.receipt_number,
            payment_date: payment.payment_date,
            student: {
                name: payment.students?.profile?.full_name,
                roll_number: payment.students?.roll_number,
                class: payment.students?.class_groups?.name,
                email: payment.students?.profile?.email,
                phone: payment.students?.profile?.phone
            },
            fee_component: {
                fee_name: payment.monthly_fee_components?.fee_name,
                fee_type: payment.monthly_fee_components?.fee_type,
                period: `${payment.monthly_fee_components?.period_month}/${payment.monthly_fee_components?.period_year}`,
                fee_amount: payment.monthly_fee_components?.fee_amount,
                paid_amount: payment.payment_amount
            },
            payment_details: {
                amount: payment.payment_amount,
                mode: payment.payment_mode,
                transaction_id: payment.transaction_id,
                cheque_number: payment.cheque_number,
                bank_name: payment.bank_name
            },
            received_by: payment.received_by_profile?.full_name || 'Clerk',
            school: {
                name: payment.schools?.name,
                address: payment.schools?.address,
                phone: payment.schools?.phone,
                email: payment.schools?.email
            },
            notes: payment.notes
        };
        return res.json({ receipt });
    }
    catch (err) {
        console.error('[clerk-fees/receipt] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get receipt' });
    }
});
// ============================================
// 5. Get Payment History for Student
// ============================================
router.get('/student/:studentId/payments', requireRoles(['clerk', 'principal', 'student', 'parent']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { studentId } = req.params;
    try {
        // Verify student access
        if (user.role === 'student' || user.role === 'parent') {
            const { data: student } = await adminSupabase
                .from('students')
                .select('id, profile_id')
                .eq('id', studentId)
                .eq('school_id', user.schoolId)
                .single();
            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }
            if (user.role === 'student' && student.profile_id !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (user.role === 'parent') {
                const { data: guardian } = await adminSupabase
                    .from('student_guardians')
                    .select('id')
                    .eq('student_id', studentId)
                    .eq('guardian_profile_id', user.id)
                    .single();
                if (!guardian) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
        }
        // Get payment history
        const { data: payments, error: paymentsError } = await adminSupabase
            .from('monthly_fee_payments')
            .select(`
        *,
        monthly_fee_components:monthly_fee_component_id(
          fee_name,
          fee_type,
          period_year,
          period_month
        ),
        received_by_profile:profiles!monthly_fee_payments_received_by_fkey(
          full_name
        )
      `)
            .eq('student_id', studentId)
            .eq('school_id', user.schoolId)
            .order('payment_date', { ascending: false })
            .order('created_at', { ascending: false });
        if (paymentsError) {
            return res.status(500).json({ error: paymentsError.message });
        }
        return res.json({
            student_id: studentId,
            payments: payments || []
        });
    }
    catch (err) {
        console.error('[clerk-fees/payments] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get payment history' });
    }
});
export default router;
