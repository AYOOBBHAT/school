import { Router } from 'express';
import { requireRoles } from '../middleware/auth';

const router = Router();

// Get student's own attendance
router.get('/attendance', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  // Use service role key to bypass RLS for reliable access
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

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

    // Get attendance records
    const { data: attendance, error: attendanceError } = await adminSupabase
      .from('attendance')
      .select('id, date, status, created_at')
      .eq('student_id', student.id)
      .eq('school_id', user.schoolId)
      .order('date', { ascending: false })
      .limit(100); // Last 100 attendance records

    if (attendanceError) {
      console.error('[students/attendance] Error fetching attendance:', attendanceError);
      return res.status(400).json({ error: attendanceError.message });
    }

    console.log('[students/attendance] Found', attendance?.length || 0, 'attendance records for student:', student.id);

    // Calculate attendance summary
    const totalDays = attendance?.length || 0;
    const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
    const absentDays = attendance?.filter(a => a.status === 'absent').length || 0;
    const lateDays = attendance?.filter(a => a.status === 'late').length || 0;
    const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0;

    const summary = {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100
    };

    console.log('[students/attendance] Attendance summary:', summary);

    return res.json({
      attendance: attendance || [],
      summary
    });
  } catch (err: any) {
    console.error('[students/attendance] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get student's own marks
router.get('/marks', requireRoles(['student']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

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

    // Group marks by exam
    const marksByExam: Record<string, any> = {};
    marks?.forEach((mark: any) => {
      const examId = mark.exam_id;
      if (!marksByExam[examId]) {
        marksByExam[examId] = {
          exam: mark.exams,
          subjects: []
        };
      }
      marksByExam[examId].subjects.push({
        subject: mark.subjects,
        marks_obtained: mark.marks_obtained,
        max_marks: mark.max_marks,
        percentage: mark.max_marks > 0 ? ((mark.marks_obtained / mark.max_marks) * 100).toFixed(2) : 0
      });
    });

    // Helper function to calculate grade from percentage
    const calculateGrade = (percentage: number): string => {
      if (percentage >= 90) return 'A+';
      if (percentage >= 80) return 'A';
      if (percentage >= 70) return 'B+';
      if (percentage >= 60) return 'B';
      if (percentage >= 50) return 'C+';
      if (percentage >= 40) return 'C';
      return 'F';
    };

    // Calculate overall percentage, total, average, and grade for each exam
    Object.keys(marksByExam).forEach(examId => {
      const examMarks = marksByExam[examId];
      const totalObtained = examMarks.subjects.reduce((sum: number, s: any) => sum + (s.marks_obtained || 0), 0);
      const totalMax = examMarks.subjects.reduce((sum: number, s: any) => sum + (s.max_marks || 0), 0);
      const percentage = totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
      const average = examMarks.subjects.length > 0 
        ? parseFloat((totalObtained / examMarks.subjects.length).toFixed(2))
        : 0;
      
      examMarks.total = totalObtained;
      examMarks.totalMax = totalMax;
      examMarks.average = average;
      examMarks.overallPercentage = percentage.toFixed(2);
      examMarks.grade = calculateGrade(percentage);
    });

    return res.json({
      marks: Object.values(marksByExam),
      raw: marks || []
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get student's own fees and payments
router.get('/fees', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  // Use service role key to bypass RLS for reliable access
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

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
    const feeStatus = (feeStructures || []).map((fee: any) => {
      const feePayments = (payments || []).filter((p: any) => p.fee_structure_id === fee.id);
      const totalPaid = feePayments.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
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
    const totalFees = feeStatus.reduce((sum: number, fee: any) => sum + (fee.amount || 0), 0);
    const totalPaid = feeStatus.reduce((sum: number, fee: any) => sum + (fee.totalPaid || 0), 0);
    const totalRemaining = feeStatus.reduce((sum: number, fee: any) => sum + (fee.remaining || 0), 0);
    const overdueFees = feeStatus.filter((fee: any) => fee.isOverdue).length;

    const summary = {
      totalFees,
      totalPaid,
      totalRemaining,
      overdueFees,
      paidFees: feeStatus.filter((f: any) => f.isPaid).length,
      totalFeeStructures: feeStatus.length
    };

    console.log('[students/fees] Fee summary:', summary);

    return res.json({
      fees: feeStatus,
      summary,
      payments: payments || []
    });
  } catch (err: any) {
    console.error('[students/fees] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get student's profile information
router.get('/profile', requireRoles(['student']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  // Use service role key to bypass RLS for reliable access
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

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
  } catch (err: any) {
    console.error('[students/profile] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

