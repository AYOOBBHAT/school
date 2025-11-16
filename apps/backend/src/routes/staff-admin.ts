import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Get all staff members (teachers, clerks, principals) for the school
router.get('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  // Use service role key to bypass RLS for admin operations
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all staff members (teachers, clerks, and principals)
    const { data: staff, error } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email, role, approval_status, phone, created_at, approved_at')
      .eq('school_id', user.schoolId)
      .in('role', ['teacher', 'clerk', 'principal'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[staff-admin] Error fetching staff:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log(`[staff-admin] Found ${staff?.length || 0} staff members for school ${user.schoolId}`);

    return res.json({
      staff: staff || [],
      total: staff?.length || 0
    });
  } catch (err: any) {
    console.error('[staff-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Update staff member (edit info or deactivate)
router.put('/:staffId', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { staffId } = req.params;
  const { full_name, email, phone, approval_status } = req.body;

  try {
    // Verify staff member belongs to the school
    const { data: staff, error: staffError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', staffId)
      .eq('school_id', user.schoolId)
      .in('role', ['teacher', 'clerk'])
      .single();

    if (staffError || !staff) {
      return res.status(404).json({ error: 'Staff member not found or access denied' });
    }

    // Don't allow changing principal
    if (staff.role === 'principal') {
      return res.status(403).json({ error: 'Cannot modify principal profile' });
    }

    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (approval_status !== undefined) {
      // Only allow setting to 'approved' or 'rejected' (not 'pending')
      if (approval_status === 'approved' || approval_status === 'rejected') {
        updateData.approval_status = approval_status;
        updateData.approved_by = user.id;
        updateData.approved_at = new Date().toISOString();
      }
    }

    const { data: updatedStaff, error: updateError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', staffId)
      .select()
      .single();

    if (updateError) {
      console.error('[staff-admin] Error updating staff:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    console.log('[staff-admin] Staff updated successfully:', updatedStaff);
    return res.json({ staff: updatedStaff, message: 'Staff member updated successfully' });
  } catch (err: any) {
    console.error('[staff-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get teacher performance metrics
router.get('/:teacherId/performance', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { teacherId } = req.params;

  try {
    // Verify teacher belongs to the school
    const { data: teacher, error: teacherError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', teacherId)
      .eq('school_id', user.schoolId)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Get teacher attendance summary
    const { data: attendance, error: attendanceError } = await adminSupabase
      .from('teacher_attendance')
      .select('status, date')
      .eq('teacher_id', teacherId)
      .eq('school_id', user.schoolId)
      .order('date', { ascending: false })
      .limit(100);

    if (attendanceError) {
      console.error('[staff-admin] Error fetching attendance:', attendanceError);
    }

    // Get marks for classes/subjects assigned to this teacher
    // First get teacher's assignments
    const { data: assignments, error: assignmentsError } = await adminSupabase
      .from('teacher_assignments')
      .select('class_group_id, subject_id')
      .eq('teacher_id', teacherId)
      .eq('school_id', user.schoolId);

    let marks: any[] = [];
    if (assignments && assignments.length > 0) {
      // Get marks for assigned subjects
      const subjectIds = assignments.map((a: any) => a.subject_id);
      const { data: marksData, error: marksError } = await adminSupabase
        .from('marks')
        .select('id, marks_obtained, max_marks, verified_by, subject_id')
        .eq('school_id', user.schoolId)
        .in('subject_id', subjectIds);

      if (marksError) {
        console.error('[staff-admin] Error fetching marks:', marksError);
      } else {
        marks = marksData || [];
      }
    }

    // Calculate attendance metrics
    const totalDays = attendance?.length || 0;
    const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
    const absentDays = attendance?.filter(a => a.status === 'absent').length || 0;
    const lateDays = attendance?.filter(a => a.status === 'late').length || 0;
    const leaveDays = attendance?.filter(a => a.status === 'leave').length || 0;
    const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0;

    // Calculate marks metrics
    const totalMarks = marks?.length || 0;
    const verifiedMarks = marks?.filter(m => m.verified_by).length || 0;
    const verificationRate = totalMarks > 0 ? (verifiedMarks / totalMarks) * 100 : 0;

    return res.json({
      attendance: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        leaveDays,
        attendancePercentage: Math.round(attendancePercentage * 100) / 100,
        recentRecords: attendance?.slice(0, 30) || []
      },
      marks: {
        totalEntered: totalMarks,
        verified: verifiedMarks,
        verificationRate: Math.round(verificationRate * 100) / 100
      }
    });
  } catch (err: any) {
    console.error('[staff-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

