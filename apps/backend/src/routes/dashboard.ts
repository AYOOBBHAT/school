import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';

const router = Router();

// General dashboard endpoint - returns role-specific stats
router.get('/', requireRoles(['principal', 'clerk', 'teacher', 'student']), async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }


  try {
    const stats: any = {};

    if (user.role === 'principal') {
      // Principal gets full stats - use single RPC call instead of 4 separate queries
      const { data: counts, error: rpcError } = await adminSupabase.rpc('get_dashboard_counts', {
        p_school_id: user.schoolId
      });

      if (rpcError) {
        console.error('[dashboard] RPC error:', rpcError);
        return res.status(500).json({ error: rpcError.message || 'Failed to get dashboard counts' });
      }

      // Use counts from single query result
      stats.total_students = counts?.total_students || 0;
      stats.total_teachers = counts?.total_teachers || 0;
      stats.total_classes = counts?.total_classes || 0;
      stats.pending_approvals = counts?.pending_approvals || 0;
    } else if (user.role === 'teacher') {
      // Teacher gets their assignment count and today's attendance
      const today = new Date().toISOString().split('T')[0];
      const [assignmentsResponse, todayAttendanceResponse] = await Promise.all([
        adminSupabase
          .from('teacher_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', user.id)
          .eq('school_id', user.schoolId),
        adminSupabase
          .from('student_attendance')
          .select('id', { count: 'exact', head: true })
          .eq('attendance_date', today)
          .eq('marked_by', user.id)
      ]);

      stats.total_classes = assignmentsResponse.count || 0;
      stats.today_attendance = todayAttendanceResponse.count || 0;
    } else if (user.role === 'student') {
      // Student gets their class count
      const studentResponse = await adminSupabase
        .from('students')
        .select('id, class_group_id')
        .eq('profile_id', user.id)
        .eq('school_id', user.schoolId)
        .single();

      // If student has a class, count as 1, otherwise 0
      stats.total_classes = studentResponse.data?.class_group_id ? 1 : 0;
    } else if (user.role === 'clerk') {
      // Clerk gets basic stats - can be extended later
      stats.total_classes = 0;
    }

    return res.json(stats);
  } catch (err: unknown) {
    console.error('[dashboard] Error building dashboard:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
});


router.get('/stats', requireRoles(['principal']), async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }


  try {
    // Call PostgreSQL function to do all aggregation in the database
    // This returns only aggregated counts, never full rows
    const { data: stats, error: rpcError } = await adminSupabase.rpc('get_dashboard_stats', {
      p_school_id: user.schoolId
    });

    if (rpcError) {
      console.error('[dashboard/stats] RPC error:', rpcError);
      return res.status(500).json({ error: rpcError.message || 'Failed to get dashboard stats' });
    }

    if (!stats) {
      return res.json({
        stats: {
          totalStudents: 0,
          totalStaff: 0,
          totalClasses: 0,
          studentsByGender: {
            total: 0,
            male: 0,
            female: 0,
            other: 0,
            unknown: 0
          },
          staffByGender: {
            total: 0,
            male: 0,
            female: 0,
            other: 0,
            unknown: 0
          }
        }
      });
    }

    return res.json({ stats });
  } catch (err: unknown) {
    console.error('[dashboard/stats] Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
});

export default router;


