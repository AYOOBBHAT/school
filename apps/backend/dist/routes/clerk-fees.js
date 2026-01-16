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
// ============================================
// 6. Get Unpaid Fee Analytics
// ============================================
router.get('/analytics/unpaid', requireRoles(['clerk', 'principal']), async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        const { class_group_id, time_scope, page = 1, limit = 20 } = req.query;
        // Validate time scope
        const validTimeScopes = ['last_month', 'last_2_months', 'last_3_months', 'last_6_months', 'current_academic_year', 'custom'];
        const timeScope = time_scope || 'last_month';
        if (!validTimeScopes.includes(timeScope)) {
            return res.status(400).json({ error: 'Invalid time scope' });
        }
        // Calculate date range based on time scope
        const today = new Date();
        let startDate;
        let endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
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
            case 'current_academic_year':
                // Assume academic year starts in April (month 3)
                const currentMonth = today.getMonth();
                const academicYearStart = currentMonth >= 3
                    ? new Date(today.getFullYear(), 3, 1) // April of current year
                    : new Date(today.getFullYear() - 1, 3, 1); // April of previous year
                startDate = academicYearStart;
                break;
            default:
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        }
        // Get ALL students first (not just those with unpaid components)
        let allStudentsQuery = adminSupabase
            .from('students')
            .select(`
        id,
        roll_number,
        class_group_id,
        admission_date,
        profile:profiles!students_profile_id_fkey(
          full_name,
          email,
          phone,
          address
        ),
        class_groups:class_group_id(
          id,
          name
        )
      `)
            .eq('school_id', user.schoolId)
            .eq('status', 'active');
        // Filter by class if provided
        if (class_group_id) {
            allStudentsQuery = allStudentsQuery.eq('class_group_id', class_group_id);
        }
        const { data: allStudents, error: studentsError } = await allStudentsQuery;
        if (studentsError) {
            console.error('[analytics/unpaid] Error fetching students:', studentsError);
            return res.status(500).json({ error: studentsError.message });
        }
        if (!allStudents || allStudents.length === 0) {
            return res.json({
                summary: {
                    total_students: 0,
                    unpaid_count: 0,
                    partially_paid_count: 0,
                    paid_count: 0,
                    total_unpaid_amount: 0
                },
                chart_data: { paid: 0, unpaid: 0, partially_paid: 0 },
                students: [],
                pagination: { page: 1, limit: 20, total: 0, total_pages: 0 }
            });
        }
        const allStudentIds = allStudents.map((s) => s.id);
        // Get ALL components for these students (including paid ones) to correctly determine payment status
        // We'll filter unpaid ones later for the list, but need all to determine if student is paid
        let allComponentsQuery = adminSupabase
            .from('monthly_fee_components')
            .select('id, student_id, fee_type, fee_name, fee_category_id, fee_amount, paid_amount, pending_amount, status, period_year, period_month, period_start, period_end')
            .eq('school_id', user.schoolId)
            .in('student_id', allStudentIds);
        const { data: allComponents, error: allComponentsError } = await allComponentsQuery;
        if (allComponentsError) {
            console.error('[analytics/unpaid] Error fetching all components:', allComponentsError);
            return res.status(500).json({ error: allComponentsError.message });
        }
        // Filter to get only unpaid components (for the unpaid list)
        // A component is unpaid if pending_amount > 0 (regardless of status, as status might not always be accurate)
        const unpaidComponents = (allComponents || []).filter((c) => parseFloat(c.pending_amount || 0) > 0);
        // Filter unpaid components by date range (for pending_months calculation)
        const filteredUnpaidComponents = unpaidComponents.filter((comp) => {
            const compStart = new Date(comp.period_start);
            const compEnd = new Date(comp.period_end);
            return compStart >= startDate && compEnd <= endDate;
        });
        const students = allStudents;
        if (studentsError) {
            console.error('[analytics/unpaid] Error fetching students:', studentsError);
            return res.status(500).json({ error: studentsError.message || 'Failed to fetch students' });
        }
        // Get guardians for students
        const filteredStudentIds = (students || []).map((s) => s.id);
        const { data: guardians } = await adminSupabase
            .from('student_guardians')
            .select(`
        student_id,
        guardian_profile:profiles!student_guardians_guardian_profile_id_fkey(
          full_name,
          phone,
          address
        )
      `)
            .in('student_id', filteredStudentIds);
        // Group guardians by student and get first one (primary if is_primary exists, otherwise first)
        const guardianByStudent = new Map();
        (guardians || []).forEach((g) => {
            if (!guardianByStudent.has(g.student_id)) {
                const guardian = Array.isArray(g.guardian_profile) ? g.guardian_profile[0] : g.guardian_profile;
                guardianByStudent.set(g.student_id, guardian);
            }
        });
        // Use guardianByStudent map
        const guardianMap = guardianByStudent;
        // Group by student and calculate totals
        const studentMap = new Map();
        // Create student map for quick lookup
        const studentLookup = new Map();
        (students || []).forEach((s) => {
            const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
            const classGroup = Array.isArray(s.class_groups) ? s.class_groups[0] : s.class_groups;
            const guardian = guardianMap.get(s.id);
            studentLookup.set(s.id, {
                profile,
                classGroup,
                guardian,
                roll_number: s.roll_number
            });
        });
        // Group unpaid components by student (using filtered components for period calculation)
        filteredUnpaidComponents.forEach((comp) => {
            const studentInfo = studentLookup.get(comp.student_id);
            if (!studentInfo)
                return; // Skip if student not found (filtered by class)
            const studentId = comp.student_id;
            const { profile, classGroup, guardian, roll_number } = studentInfo;
            if (!studentMap.has(studentId)) {
                studentMap.set(studentId, {
                    student_id: studentId,
                    student_name: profile?.full_name || 'Unknown',
                    roll_number: roll_number || 'N/A',
                    class_name: classGroup?.name || 'N/A',
                    parent_name: guardian?.full_name || profile?.full_name || 'N/A',
                    parent_phone: guardian?.phone || profile?.phone || 'N/A',
                    parent_address: guardian?.address || profile?.address || 'N/A',
                    pending_months: 0,
                    total_pending: 0,
                    total_fee: 0,
                    total_paid: 0,
                    payment_status: 'unpaid'
                });
            }
            const studentData = studentMap.get(studentId);
            studentData.pending_months += 1;
            studentData.total_pending += parseFloat(comp.pending_amount || 0);
            studentData.total_fee += parseFloat(comp.fee_amount || 0);
            studentData.total_paid += parseFloat(comp.paid_amount || 0);
            // Update payment status
            if (comp.status === 'partially-paid' || studentData.total_paid > 0) {
                studentData.payment_status = 'partially-paid';
            }
        });
        // Now we need to check ALL students, not just those with unpaid components
        // For students not in studentMap, check if they have any unpaid components in the time period
        const studentsList = [];
        const totalStudents = students.length;
        // Process all students
        students.forEach((s) => {
            const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile;
            const classGroup = Array.isArray(s.class_groups) ? s.class_groups[0] : s.class_groups;
            const guardian = guardianMap.get(s.id);
            // Get ALL components for this student (paid and unpaid) to determine status correctly
            const allStudentComponents = (allComponents || []).filter((c) => c.student_id === s.id);
            // Get unpaid components for this student
            const studentUnpaidComponents = unpaidComponents.filter((c) => c.student_id === s.id);
            // Get unpaid components in the selected time period
            const studentUnpaidInPeriod = filteredUnpaidComponents.filter((c) => c.student_id === s.id);
            // Calculate totals from ALL components (to get accurate fee/paid amounts)
            const totalFee = allStudentComponents.reduce((sum, c) => sum + parseFloat(c.fee_amount || 0), 0);
            const totalPaid = allStudentComponents.reduce((sum, c) => sum + parseFloat(c.paid_amount || 0), 0);
            const totalPending = studentUnpaidComponents.reduce((sum, c) => sum + parseFloat(c.pending_amount || 0), 0);
            // Determine payment status based on unpaid components AND missing months
            // CRITICAL: A student is unpaid if:
            // 1. They have unpaid components (pending_amount > 0), OR
            // 2. They have months without any components (bills not generated)
            let paymentStatus;
            // Calculate expected months for this student in the time scope
            // Get student admission date to determine expected months
            const studentAdmissionDate = s.admission_date
                ? new Date(s.admission_date)
                : new Date(startDate.getFullYear(), 0, 1);
            // Generate expected months from admission date (or time scope start, whichever is later) to time scope end
            const expectedMonths = [];
            const monthStart = new Date(Math.max(studentAdmissionDate.getTime(), startDate.getTime()));
            const monthEnd = new Date(endDate);
            let currentMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
            while (currentMonth <= monthEnd) {
                expectedMonths.push({
                    year: currentMonth.getFullYear(),
                    month: currentMonth.getMonth() + 1
                });
                currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
            }
            // Check which expected months have components
            const monthsWithComponents = new Set();
            allStudentComponents.forEach((comp) => {
                const monthKey = `${comp.period_year}-${comp.period_month}`;
                monthsWithComponents.add(monthKey);
            });
            // Check for missing months (months without any components)
            const missingMonths = expectedMonths.filter(em => {
                const monthKey = `${em.year}-${em.month}`;
                return !monthsWithComponents.has(monthKey);
            });
            // Determine status
            if (studentUnpaidComponents.length === 0 && missingMonths.length === 0) {
                // No unpaid components AND no missing months - student is fully paid
                paymentStatus = 'paid';
            }
            else if (missingMonths.length > 0) {
                // Has missing months (no bills generated) - student is unpaid
                // Even if existing components are paid, missing months = unpaid
                paymentStatus = 'unpaid';
            }
            else {
                // Has unpaid components - check if any of them have partial payments
                const hasPartialPayment = studentUnpaidComponents.some((c) => parseFloat(c.paid_amount || 0) > 0);
                paymentStatus = hasPartialPayment ? 'partially-paid' : 'unpaid';
            }
            // Calculate fee component breakdown
            // Group components by fee_type and fee_name (or fee_category_id for unique identification)
            const componentBreakdownMap = new Map();
            allStudentComponents.forEach((comp) => {
                // Create a unique key for grouping: fee_type + fee_name (or fee_category_id if available)
                // For transport, use fee_name; for others, use fee_category_id if available, otherwise fee_name
                const groupKey = comp.fee_type === 'transport-fee'
                    ? `${comp.fee_type}:${comp.fee_name}`
                    : comp.fee_category_id
                        ? `${comp.fee_type}:${comp.fee_category_id}`
                        : `${comp.fee_type}:${comp.fee_name}`;
                if (!componentBreakdownMap.has(groupKey)) {
                    componentBreakdownMap.set(groupKey, {
                        fee_type: comp.fee_type,
                        fee_name: comp.fee_name || 'Unknown Fee',
                        components: []
                    });
                }
                componentBreakdownMap.get(groupKey).components.push(comp);
            });
            // Helper function to format month name from period_year and period_month
            const formatMonthName = (year, month) => {
                const date = new Date(year, month - 1, 1);
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            };
            // Sort components by period (year and month) to get chronological order
            const sortComponentsByPeriod = (comps) => {
                return [...comps].sort((a, b) => {
                    if (a.period_year !== b.period_year) {
                        return a.period_year - b.period_year;
                    }
                    return a.period_month - b.period_month;
                });
            };
            // Calculate breakdown for each fee component
            const feeComponentBreakdown = [];
            componentBreakdownMap.forEach((group) => {
                const components = sortComponentsByPeriod(group.components);
                const totalMonthsDue = components.length;
                // Get all month names (sorted chronologically)
                const allMonthNames = components.map((c) => formatMonthName(c.period_year, c.period_month));
                // Calculate paid months: months where paid_amount >= fee_amount (fully paid)
                const paidComponents = components.filter((c) => parseFloat(c.paid_amount || 0) >= parseFloat(c.fee_amount || 0) && parseFloat(c.fee_amount || 0) > 0);
                const paidMonths = paidComponents.length;
                const paidMonthNames = paidComponents.map((c) => formatMonthName(c.period_year, c.period_month));
                // Calculate pending months: months where pending_amount > 0
                const pendingComponents = components.filter((c) => parseFloat(c.pending_amount || 0) > 0);
                const pendingMonths = pendingComponents.length;
                const pendingMonthNames = pendingComponents.map((c) => formatMonthName(c.period_year, c.period_month));
                // Calculate amounts
                const totalFeeAmount = components.reduce((sum, c) => sum + parseFloat(c.fee_amount || 0), 0);
                const totalPaidAmount = components.reduce((sum, c) => sum + parseFloat(c.paid_amount || 0), 0);
                const totalPendingAmount = components.reduce((sum, c) => sum + parseFloat(c.pending_amount || 0), 0);
                feeComponentBreakdown.push({
                    fee_type: group.fee_type,
                    fee_name: group.fee_name,
                    total_months_due: totalMonthsDue,
                    total_months_due_names: allMonthNames,
                    paid_months: paidMonths,
                    paid_months_names: paidMonthNames,
                    pending_months: pendingMonths,
                    pending_months_names: pendingMonthNames,
                    total_fee_amount: totalFeeAmount,
                    total_paid_amount: totalPaidAmount,
                    total_pending_amount: totalPendingAmount
                });
            });
            // Sort breakdown by fee_type (class-fee first, then transport-fee, then custom-fee)
            feeComponentBreakdown.sort((a, b) => {
                const order = { 'class-fee': 1, 'transport-fee': 2, 'custom-fee': 3 };
                return (order[a.fee_type] || 99) - (order[b.fee_type] || 99);
            });
            // Format pending months as breakdown string: "3 class fee, 2 transport, 1 library fee"
            const pendingMonthsBreakdown = feeComponentBreakdown
                .filter(component => component.pending_months > 0)
                .map(component => {
                // Format fee name - capitalize first letter and make it lowercase for consistency
                const feeName = component.fee_name.toLowerCase();
                return `${component.pending_months} ${feeName}`;
            })
                .join(', ');
            // Only add to list if student has unpaid fees OR if we want to show all students
            // For unpaid analytics, we only show students with unpaid fees
            if (studentUnpaidComponents.length > 0) {
                studentsList.push({
                    student_id: s.id,
                    student_name: profile?.full_name || 'Unknown',
                    roll_number: s.roll_number || 'N/A',
                    class_name: classGroup?.name || 'N/A',
                    parent_name: guardian?.full_name || profile?.full_name || 'N/A',
                    parent_phone: guardian?.phone || profile?.phone || 'N/A',
                    parent_address: guardian?.address || profile?.address || 'N/A',
                    pending_months: pendingMonthsBreakdown || '0',
                    total_pending: totalPending,
                    total_fee: totalFee,
                    total_paid: totalPaid,
                    payment_status: paymentStatus,
                    fee_component_breakdown: feeComponentBreakdown
                });
            }
        });
        // studentsList already only contains students with unpaid fees, so no need to filter again
        const unpaidStudentsList = studentsList;
        // Calculate chart data - need to check ALL students, not just those in studentsList
        // studentsList only contains students with unpaid fees, so we need to check all students
        const studentStatusMap = new Map();
        // First, mark all students in studentsList with their status
        studentsList.forEach(s => {
            studentStatusMap.set(s.student_id, s.payment_status);
        });
        // Then check remaining students (those not in studentsList) - they should be paid
        students.forEach((s) => {
            if (!studentStatusMap.has(s.id)) {
                // Student not in unpaid list - they have no unpaid components, so they're paid
                studentStatusMap.set(s.id, 'paid');
            }
        });
        // Count students by status
        const unpaidCount = Array.from(studentStatusMap.values()).filter(s => s === 'unpaid').length;
        const partiallyPaidCount = Array.from(studentStatusMap.values()).filter(s => s === 'partially-paid').length;
        const paidCount = Array.from(studentStatusMap.values()).filter(s => s === 'paid').length;
        // Pagination - only paginate unpaid/partially-paid students
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedStudents = unpaidStudentsList.slice(startIndex, endIndex);
        return res.json({
            summary: {
                total_students: totalStudents,
                unpaid_count: unpaidCount,
                partially_paid_count: partiallyPaidCount,
                paid_count: paidCount,
                total_unpaid_amount: unpaidStudentsList.reduce((sum, s) => sum + s.total_pending, 0)
            },
            chart_data: {
                paid: paidCount,
                unpaid: unpaidCount,
                partially_paid: partiallyPaidCount
            },
            students: paginatedStudents,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: unpaidStudentsList.length,
                total_pages: Math.ceil(unpaidStudentsList.length / limitNum)
            }
        });
    }
    catch (err) {
        console.error('[analytics/unpaid] Error:', err);
        return res.status(500).json({ error: err.message || 'Failed to get unpaid fee analytics' });
    }
});
export default router;
