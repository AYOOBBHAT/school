import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';

const router = Router();

// Get all staff members (teachers, clerks, principals) for the school
router.get('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    // Parse filters
    const role = req.query.role as string || 'all';
    const status = req.query.status as string || 'all'; // approval_status filter

    // Build query with adminSupabase to bypass RLS for principal
    let query = adminSupabase
      .from('profiles')
      .select('id, full_name, email, role, approval_status, phone, created_at', { count: 'exact' })
      .eq('school_id', user.schoolId) // Filter by school_id explicitly
      .in('role', ['teacher', 'clerk', 'principal']);

    // Apply role filter only when not "all"
    if (role !== 'all') {
      query = query.eq('role', role);
    }

    // Apply approval_status filter only when not "all"
    if (status !== 'all') {
      query = query.eq('approval_status', status);
    }

    // Apply pagination using range (NOT offset + limit, but offset to offset + limit - 1)
    query = query.range(offset, offset + limit - 1);

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: staff, error, count } = await query;

    if (error) {
      console.error('[staff-admin] Error fetching staff:', error);
      console.error('[staff-admin] Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return res.status(400).json({ error: error.message || 'Failed to fetch staff' });
    }

    console.log(`[staff-admin] Found ${staff?.length || 0} staff members (total: ${count || 0}) for school ${user.schoolId}`);

    return res.json({
      staff: staff || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    console.error('[staff-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Update staff member (edit info or deactivate)
router.put('/:staffId', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user, supabase } = req;
  if (!user || !supabase) return res.status(500).json({ error: 'Server misconfigured' });

  const { staffId } = req.params;
  const { full_name, email, phone, approval_status } = req.body;

  try {
    // Verify staff member belongs to the school (RLS enforces this)
    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', staffId)
      .in('role', ['teacher', 'clerk'])
      .maybeSingle();

    if (staffError || !staff) {
      console.error('[staff-admin] Error fetching staff:', staffError);
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

    const { data: updatedStaff, error: updateError } = await supabase
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
  const { user, supabase } = req;
  if (!user || !supabase) return res.status(500).json({ error: 'Server misconfigured' });

  const { teacherId } = req.params;

  try {
    // Verify teacher belongs to the school (RLS enforces this)
    const { data: teacher, error: teacherError } = await supabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .maybeSingle();

    if (teacherError || !teacher) {
      console.error('[staff-admin] Error fetching teacher:', teacherError);
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Get teacher attendance summary (RLS enforces school_id)
    const { data: attendance, error: attendanceError } = await supabase
      .from('teacher_attendance')
      .select('status, date')
      .eq('teacher_id', teacherId)
      .order('date', { ascending: false })
      .limit(100);

    if (attendanceError) {
      console.error('[staff-admin] Error fetching attendance:', attendanceError);
    }

    // Get marks for classes/subjects assigned to this teacher
    // First get teacher's assignments (RLS enforces school_id)
    const { data: assignments, error: assignmentsError } = await supabase
      .from('teacher_assignments')
      .select('class_group_id, subject_id')
      .eq('teacher_id', teacherId);

    let marks: any[] = [];
    if (assignments && assignments.length > 0) {
      // Get marks for assigned subjects (RLS enforces school_id)
      const subjectIds = assignments.map((a: any) => a.subject_id);
      const { data: marksData, error: marksError } = await supabase
        .from('marks')
        .select('id, marks_obtained, max_marks, verified_by, subject_id')
        .in('subject_id', subjectIds);

      if (marksError) {
        console.error('[staff-admin] Error fetching marks:', marksError);
      } else {
        marks = marksData || [];
      }
    }

    // Calculate attendance metrics
    const totalDays = attendance?.length || 0;
    const presentDays = attendance?.filter((a: any) => a.status === 'present').length || 0;
    const absentDays = attendance?.filter((a: any) => a.status === 'absent').length || 0;
    const lateDays = attendance?.filter((a: any) => a.status === 'late').length || 0;
    const leaveDays = attendance?.filter((a: any) => a.status === 'leave').length || 0;
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

