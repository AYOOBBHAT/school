import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
// ======================================================
// ADMIN/STAFF: LIST STUDENTS (for principal / clerk / teacher)
// ======================================================
// Used by Clerk/Principal dashboards and management views.
// Returns a flat list of students with basic profile info, scoped to the school.
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
    const { user } = req;
    if (!user) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    if (!user.schoolId) {
        return res.status(403).json({ error: 'School scope required' });
    }
    // Use shared admin client (bypass RLS but enforce school_id in query)
    const { adminSupabase } = await import('../utils/supabaseAdmin.js');
    try {
        const { data, error } = await adminSupabase
            .from('students')
            .select(`
        id,
        roll_number,
        status,
        profile_id,
        profiles:profile_id (
          id,
          full_name,
          email,
          phone
        )
      `)
            .eq('school_id', user.schoolId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('[students:list] Error fetching students:', error);
            return res.status(400).json({ error: error.message });
        }
        const students = (data || []).map((s) => ({
            id: s.id,
            roll_number: s.roll_number,
            status: s.status,
            profile_id: s.profile_id,
            profile: {
                id: s.profiles?.id ?? s.profile_id,
                full_name: s.profiles?.full_name ?? 'Unknown',
                email: s.profiles?.email ?? '',
                phone: s.profiles?.phone ?? undefined,
            },
        })) ?? [];
        return res.json({ students });
    }
    catch (err) {
        console.error('[students:list] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get student's own attendance
router.get('/attendance', requireRoles(['student']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use shared admin client
    const { adminSupabase } = await import('../utils/supabaseAdmin.js');
    try {
        // Get student record
        const { data: student, error: studentError } = await adminSupabase
            .from('students')
            .select('id')
            .eq('profile_id', user.id)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            console.error('[students/attendance] Student record not found:', studentError);
            return res.status(404).json({ error: 'Student record not found' });
        }
        // Get attendance records from student_attendance table (new system)
        const { data: attendance, error: attendanceError } = await adminSupabase
            .from('student_attendance')
            .select('id, attendance_date, status, created_at, class_group_id, marked_by')
            .eq('student_id', student.id)
            .eq('school_id', user.schoolId)
            .order('attendance_date', { ascending: false })
            .limit(100); // Last 100 attendance records
        // Transform to match expected format (date -> attendance_date)
        const transformedAttendance = attendance?.map((a) => ({
            id: a.id,
            date: a.attendance_date,
            status: a.status,
            created_at: a.created_at,
            class_group_id: a.class_group_id,
            marked_by: a.marked_by
        })) || [];
        if (attendanceError) {
            console.error('[students/attendance] Error fetching attendance:', attendanceError);
            return res.status(400).json({ error: attendanceError.message });
        }
        console.log('[students/attendance] Found', transformedAttendance?.length || 0, 'attendance records for student:', student.id);
        // Calculate attendance summary
        const totalDays = transformedAttendance?.length || 0;
        const presentDays = transformedAttendance?.filter((a) => a.status === 'present').length || 0;
        const absentDays = transformedAttendance?.filter((a) => a.status === 'absent').length || 0;
        const lateDays = transformedAttendance?.filter((a) => a.status === 'late').length || 0;
        const leaveDays = transformedAttendance?.filter((a) => a.status === 'leave').length || 0;
        const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0;
        const summary = {
            totalDays,
            presentDays,
            absentDays,
            lateDays,
            leaveDays,
            attendancePercentage: Math.round(attendancePercentage * 100) / 100
        };
        console.log('[students/attendance] Attendance summary:', summary);
        return res.json({
            attendance: transformedAttendance || [],
            summary
        });
    }
    catch (err) {
        console.error('[students/attendance] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get student's own marks
router.get('/marks', requireRoles(['student']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Get student record
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('profile_id', user.id)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student record not found' });
        }
        // Get verified marks with exam and subject details (only marks that have been verified)
        const { data: marks, error: marksError } = await supabase
            .from('marks')
            .select(`
        id,
        marks_obtained,
        max_marks,
        exam_id,
        subject_id,
        verified_by,
        exams:exam_id (
          id,
          name,
          term,
          start_date,
          end_date
        ),
        subjects:subject_id (
          id,
          name,
          code
        )
      `)
            .eq('student_id', student.id)
            .eq('school_id', user.schoolId)
            .not('verified_by', 'is', null)
            .order('exam_id', { ascending: false });
        if (marksError) {
            return res.status(400).json({ error: marksError.message });
        }
        // Pass threshold (40%)
        const PASS_THRESHOLD = 40;
        // Helper function to calculate grade from percentage (A/B/C/Fail)
        const calculateGrade = (percentage) => {
            if (percentage >= 80)
                return 'A';
            if (percentage >= 60)
                return 'B';
            if (percentage >= 40)
                return 'C';
            return 'Fail';
        };
        // Group marks by exam
        const marksByExam = {};
        marks?.forEach((mark) => {
            const examId = mark.exam_id;
            if (!marksByExam[examId]) {
                marksByExam[examId] = {
                    exam: mark.exams,
                    subjects: []
                };
            }
            const marksObtained = parseFloat(mark.marks_obtained) || 0;
            const maxMarks = parseFloat(mark.max_marks) || 0;
            const percentage = maxMarks > 0
                ? parseFloat(((marksObtained / maxMarks) * 100).toFixed(2))
                : 0;
            const status = percentage >= PASS_THRESHOLD ? 'Pass' : 'Fail';
            marksByExam[examId].subjects.push({
                subject: mark.subjects,
                marks_obtained: marksObtained,
                max_marks: maxMarks,
                percentage: percentage.toFixed(2),
                status
            });
        });
        // Calculate overall percentage, total, grade, and overall result for each exam
        Object.keys(marksByExam).forEach(examId => {
            const examMarks = marksByExam[examId];
            const totalObtained = examMarks.subjects.reduce((sum, s) => sum + (s.marks_obtained || 0), 0);
            const totalMax = examMarks.subjects.reduce((sum, s) => sum + (s.max_marks || 0), 0);
            const percentage = totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
            const average = examMarks.subjects.length > 0
                ? parseFloat((totalObtained / examMarks.subjects.length).toFixed(2))
                : 0;
            // Calculate overall result (Pass if all subjects passed)
            const allPassed = examMarks.subjects.length > 0 && examMarks.subjects.every((s) => s.status === 'Pass');
            examMarks.total_obtained = totalObtained;
            examMarks.total_max = totalMax;
            examMarks.average = average;
            examMarks.total_percentage = percentage.toFixed(2);
            examMarks.grade = calculateGrade(percentage);
            examMarks.overall_result = allPassed ? 'Pass' : 'Fail';
            // Keep backward compatibility
            examMarks.total = totalObtained;
            examMarks.totalMax = totalMax;
            examMarks.overallPercentage = percentage.toFixed(2);
        });
        return res.json({
            marks: Object.values(marksByExam),
            raw: marks || []
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get student's exam results for a specific exam
router.get('/exam-results/:examId', requireRoles(['student']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    const { examId } = req.params;
    try {
        // Get student record
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('profile_id', user.id)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            return res.status(404).json({ error: 'Student record not found' });
        }
        // Get exam details
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('id, name, term, start_date, end_date')
            .eq('id', examId)
            .eq('school_id', user.schoolId)
            .single();
        if (examError || !exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        // Get verified marks for this exam
        const { data: marks, error: marksError } = await supabase
            .from('marks')
            .select(`
        id,
        marks_obtained,
        max_marks,
        subject_id,
        subjects:subject_id (
          id,
          name,
          code
        )
      `)
            .eq('student_id', student.id)
            .eq('exam_id', examId)
            .eq('school_id', user.schoolId)
            .not('verified_by', 'is', null)
            .order('subjects.name', { ascending: true });
        if (marksError) {
            return res.status(400).json({ error: marksError.message });
        }
        // Pass threshold (40%)
        const PASS_THRESHOLD = 40;
        // Calculate subject-wise results
        const subjects = (marks || []).map((mark) => {
            const marksObtained = parseFloat(mark.marks_obtained) || 0;
            const maxMarks = parseFloat(mark.max_marks) || 0;
            const percentage = maxMarks > 0
                ? parseFloat(((marksObtained / maxMarks) * 100).toFixed(2))
                : 0;
            const status = percentage >= PASS_THRESHOLD ? 'Pass' : 'Fail';
            return {
                subject: mark.subjects,
                marks_obtained: marksObtained,
                max_marks: maxMarks,
                percentage: percentage.toFixed(2),
                status
            };
        });
        // Calculate overall summary
        const totalObtained = subjects.reduce((sum, s) => sum + s.marks_obtained, 0);
        const totalMax = subjects.reduce((sum, s) => sum + s.max_marks, 0);
        const totalPercentage = totalMax > 0
            ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2))
            : 0;
        // Calculate grade
        let grade;
        if (totalPercentage >= 80) {
            grade = 'A';
        }
        else if (totalPercentage >= 60) {
            grade = 'B';
        }
        else if (totalPercentage >= 40) {
            grade = 'C';
        }
        else {
            grade = 'Fail';
        }
        // Calculate overall result (Pass if all subjects passed)
        const allPassed = subjects.length > 0 && subjects.every((s) => s.status === 'Pass');
        const overallResult = allPassed ? 'Pass' : 'Fail';
        return res.json({
            exam: {
                id: exam.id,
                name: exam.name,
                term: exam.term,
                start_date: exam.start_date,
                end_date: exam.end_date
            },
            subjects,
            summary: {
                total_obtained: totalObtained,
                total_max: totalMax,
                total_percentage: totalPercentage.toFixed(2),
                grade,
                overall_result: overallResult
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get student's own fees and payments
router.get('/fees', requireRoles(['student']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use shared admin client
    const { adminSupabase } = await import('../utils/supabaseAdmin.js');
    try {
        // Get student record with class information
        const { data: student, error: studentError } = await adminSupabase
            .from('students')
            .select('id, class_group_id, section_id')
            .eq('profile_id', user.id)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError || !student) {
            console.error('[students/fees] Student record not found:', studentError);
            return res.status(404).json({ error: 'Student record not found' });
        }
        // Get fee structures for the student's class
        let feeStructuresQuery = adminSupabase
            .from('fee_structures')
            .select('id, name, amount, due_date, description')
            .eq('school_id', user.schoolId);
        if (student.class_group_id) {
            feeStructuresQuery = feeStructuresQuery.eq('class_group_id', student.class_group_id);
        }
        const { data: feeStructures, error: feeStructuresError } = await feeStructuresQuery;
        if (feeStructuresError) {
            console.error('[students/fees] Error fetching fee structures:', feeStructuresError);
            return res.status(400).json({ error: feeStructuresError.message });
        }
        // Get payments made by the student
        const { data: payments, error: paymentsError } = await adminSupabase
            .from('payments')
            .select(`
        id,
        amount_paid,
        payment_date,
        payment_mode,
        transaction_id,
        fee_structure_id,
        fee_structures:fee_structure_id (
          id,
          name,
          amount
        )
      `)
            .eq('student_id', student.id)
            .eq('school_id', user.schoolId)
            .order('payment_date', { ascending: false });
        if (paymentsError) {
            console.error('[students/fees] Error fetching payments:', paymentsError);
            return res.status(400).json({ error: paymentsError.message });
        }
        console.log('[students/fees] Found', feeStructures?.length || 0, 'fee structures and', payments?.length || 0, 'payments for student:', student.id);
        // Calculate fee status for each fee structure
        const feeStatus = (feeStructures || []).map((fee) => {
            const feePayments = (payments || []).filter((p) => p.fee_structure_id === fee.id);
            const totalPaid = feePayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
            const remaining = fee.amount - totalPaid;
            const isPaid = remaining <= 0;
            const isOverdue = fee.due_date && new Date(fee.due_date) < new Date() && !isPaid;
            return {
                ...fee,
                totalPaid,
                remaining: Math.max(0, remaining),
                isPaid,
                isOverdue,
                payments: feePayments
            };
        });
        // Calculate overall fee summary
        const totalFees = feeStatus.reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const totalPaid = feeStatus.reduce((sum, fee) => sum + (fee.totalPaid || 0), 0);
        const totalRemaining = feeStatus.reduce((sum, fee) => sum + (fee.remaining || 0), 0);
        const overdueFees = feeStatus.filter((fee) => fee.isOverdue).length;
        const summary = {
            totalFees,
            totalPaid,
            totalRemaining,
            overdueFees,
            paidFees: feeStatus.filter((f) => f.isPaid).length,
            totalFeeStructures: feeStatus.length
        };
        console.log('[students/fees] Fee summary:', summary);
        return res.json({
            fees: feeStatus,
            summary,
            payments: payments || []
        });
    }
    catch (err) {
        console.error('[students/fees] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get student's profile information
router.get('/profile', requireRoles(['student']), async (req, res) => {
    const { user } = req;
    if (!user)
        return res.status(500).json({ error: 'Server misconfigured' });
    // Use shared admin client
    const { adminSupabase } = await import('../utils/supabaseAdmin.js');
    try {
        console.log('[students/profile] Fetching student profile for user:', {
            user_id: user.id,
            school_id: user.schoolId,
            role: user.role
        });
        // First verify the profile exists and is approved
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, role, approval_status, school_id')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            console.error('[students/profile] Profile not found:', profileError);
            return res.status(404).json({ error: 'Profile not found' });
        }
        if (profile.approval_status !== 'approved') {
            console.warn('[students/profile] Profile not approved:', {
                profile_id: profile.id,
                approval_status: profile.approval_status
            });
            return res.status(403).json({ error: 'Profile not approved yet' });
        }
        // Get student record with class and profile information
        const { data: student, error: studentError } = await adminSupabase
            .from('students')
            .select(`
        id,
        roll_number,
        status,
        admission_date,
        class_group_id,
        section_id,
        profile_id,
        class_groups:class_group_id (
          id,
          name,
          description
        ),
        sections:section_id (
          id,
          name
        ),
        profiles:profile_id (
          id,
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
            .eq('profile_id', user.id)
            .eq('school_id', user.schoolId)
            .single();
        if (studentError) {
            console.error('[students/profile] Error fetching student record:', {
                error: studentError,
                profile_id: user.id,
                school_id: user.schoolId
            });
            // Check if it's a "not found" error
            if (studentError.code === 'PGRST116' || studentError.message?.includes('No rows')) {
                return res.status(404).json({
                    error: 'Student record not found. Please contact your administrator - your student record may not have been created properly.'
                });
            }
            return res.status(400).json({ error: studentError.message || 'Failed to fetch student record' });
        }
        if (!student) {
            console.error('[students/profile] Student record is null for profile_id:', user.id);
            return res.status(404).json({
                error: 'Student record not found. Please contact your administrator.'
            });
        }
        console.log('[students/profile] Student record found:', {
            student_id: student.id,
            profile_id: student.profile_id,
            class_group_id: student.class_group_id,
            status: student.status
        });
        return res.json({ student });
    }
    catch (err) {
        console.error('[students/profile] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
