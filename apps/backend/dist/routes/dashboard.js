import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
const router = Router();
// General dashboard endpoint - returns role-specific stats
// ✅ OPTIMIZED: Uses materialized views via single RPC call (no live aggregation)
router.get('/', requireRoles(['principal', 'clerk', 'teacher', 'student']), async (req, res) => {
    const { user } = req;
    if (!user) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    // Defensive multi-tenant guard: never allow unscoped access
    if (!user.schoolId) {
        return res.status(403).json({ error: 'School scope required' });
    }
    try {
        const stats = {};
        if (user.role === 'principal') {
            // Principal gets full dashboard snapshot - single RPC call to materialized views
            const { data: snapshot, error: rpcError } = await adminSupabase.rpc('get_school_dashboard_snapshot', {
                p_school_id: user.schoolId
            });
            if (rpcError) {
                console.error('[dashboard] RPC error:', rpcError);
                // Fallback to old method if RPC doesn't exist yet
                const { data: summary, error: summaryError } = await adminSupabase
                    .from('mv_school_dashboard_stats')
                    .select('*')
                    .eq('school_id', user.schoolId)
                    .single();
                if (summaryError) {
                    return res.status(500).json({ error: 'Failed to get dashboard data' });
                }
                stats.total_students = summary?.total_students || 0;
                stats.total_teachers = summary?.total_teachers || 0;
                stats.total_clerks = summary?.total_clerks || 0;
                stats.total_classes = summary?.total_classes || 0;
            }
            else {
                // Use snapshot data from materialized views
                stats.total_students = snapshot?.stats?.total_students || 0;
                stats.total_teachers = snapshot?.stats?.total_teachers || 0;
                stats.total_clerks = snapshot?.stats?.total_clerks || 0;
                stats.total_classes = snapshot?.stats?.total_classes || 0;
                stats.attendance = snapshot?.attendance || null;
                stats.fees = snapshot?.fees || null;
                stats.unpaid = snapshot?.unpaid || null;
                stats.salary = snapshot?.salary || null;
            }
        }
        else if (user.role === 'teacher') {
            // Teacher gets their assignment count and today's attendance
            // ✅ OPTIMIZED: Still uses materialized view for attendance
            const today = new Date().toISOString().split('T')[0];
            const [assignmentsResponse, todayAttendanceResponse] = await Promise.all([
                adminSupabase
                    .from('teacher_assignments')
                    .select('id', { count: 'exact', head: true })
                    .eq('teacher_id', user.id)
                    .eq('school_id', user.schoolId),
                adminSupabase
                    .from('mv_attendance_daily_summary')
                    .select('present_count, absent_count, late_count')
                    .eq('school_id', user.schoolId)
                    .eq('attendance_date', today)
                    .single()
            ]);
            stats.total_classes = assignmentsResponse.count || 0;
            stats.today_attendance = todayAttendanceResponse.data
                ? (todayAttendanceResponse.data.present_count || 0) + (todayAttendanceResponse.data.absent_count || 0) + (todayAttendanceResponse.data.late_count || 0)
                : 0;
        }
        else if (user.role === 'student') {
            // Student gets their class count (simple lookup, no aggregation needed)
            const studentResponse = await adminSupabase
                .from('students')
                .select('id, class_group_id')
                .eq('profile_id', user.id)
                .eq('school_id', user.schoolId)
                .single();
            stats.total_classes = studentResponse.data?.class_group_id ? 1 : 0;
        }
        else if (user.role === 'clerk') {
            // Clerk dashboard MUST be strictly school-scoped (multi-tenant safe)
            // Never trust frontend filters; enforce school_id scoping here.
            const today = new Date().toISOString().split('T')[0];
            const [studentsCountRes, todayPaymentsRes, pendingComponentsRes] = await Promise.all([
                // Total Students (count only)
                adminSupabase
                    .from('students')
                    .select('id', { count: 'exact', head: true })
                    .eq('school_id', user.schoolId),
                // Today Collection (sum in Node; query is strictly school-scoped)
                adminSupabase
                    .from('monthly_fee_payments')
                    .select('payment_amount')
                    .eq('school_id', user.schoolId)
                    .eq('payment_date', today),
                // Total Pending (sum in Node; only pending components)
                adminSupabase
                    .from('monthly_fee_components')
                    .select('pending_amount')
                    .eq('school_id', user.schoolId)
                    .gt('pending_amount', 0)
            ]);
            if (studentsCountRes.error) {
                return res.status(500).json({ error: studentsCountRes.error.message || 'Failed to get student count' });
            }
            if (todayPaymentsRes.error) {
                return res.status(500).json({ error: todayPaymentsRes.error.message || 'Failed to get today collection' });
            }
            if (pendingComponentsRes.error) {
                return res.status(500).json({ error: pendingComponentsRes.error.message || 'Failed to get pending total' });
            }
            const toNumber = (value) => {
                if (typeof value === 'number')
                    return value;
                if (typeof value === 'string') {
                    const parsed = parseFloat(value);
                    return Number.isFinite(parsed) ? parsed : 0;
                }
                return 0;
            };
            const todayCollection = (todayPaymentsRes.data || []).reduce((sum, row) => {
                const amount = row?.payment_amount;
                return sum + toNumber(amount);
            }, 0);
            const totalPending = (pendingComponentsRes.data || []).reduce((sum, row) => {
                const pending = row?.pending_amount;
                return sum + toNumber(pending);
            }, 0);
            stats.total_students = studentsCountRes.count || 0;
            stats.today_collection = todayCollection;
            stats.total_pending = totalPending;
        }
        return res.json(stats);
    }
    catch (err) {
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
        // Read from materialized views (instant, no aggregation)
        const [summaryResult, genderResult] = await Promise.all([
            adminSupabase
                .from('mv_school_dashboard_summary')
                .select('*')
                .eq('school_id', user.schoolId)
                .single(),
            adminSupabase
                .from('mv_school_gender_stats')
                .select('*')
                .eq('school_id', user.schoolId)
                .single()
        ]);
        // Fallback to RPC if views don't exist yet
        if (summaryResult.error || genderResult.error) {
            console.warn('[dashboard/stats] Materialized views not available, falling back to RPC');
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
        }
        // Transform materialized view data to match expected format
        const summary = summaryResult.data || {};
        const gender = genderResult.data || {};
        const stats = {
            totalStudents: gender.total_students || 0,
            totalStaff: gender.total_staff || 0,
            totalClasses: summary.total_classes || 0,
            studentsByGender: {
                total: gender.total_students || 0,
                male: gender.students_male || 0,
                female: gender.students_female || 0,
                other: gender.students_other || 0,
                unknown: gender.students_unknown || 0
            },
            staffByGender: {
                total: gender.total_staff || 0,
                male: gender.staff_male || 0,
                female: gender.staff_female || 0,
                other: gender.staff_other || 0,
                unknown: gender.staff_unknown || 0
            }
        };
        return res.json({ stats });
    }
    catch (err) {
        console.error('[dashboard/stats] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});
export default router;
