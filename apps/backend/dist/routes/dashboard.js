import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const normalizeGender = (value) => {
    if (!value)
        return 'unknown';
    const lower = value.trim().toLowerCase();
    if (['male', 'm', 'boy', 'boys'].includes(lower))
        return 'male';
    if (['female', 'f', 'girl', 'girls'].includes(lower))
        return 'female';
    if (lower && lower !== 'male' && lower !== 'female')
        return 'other';
    return 'unknown';
};
const getInitialGenderCounts = () => ({
    total: 0,
    male: 0,
    female: 0,
    other: 0,
    unknown: 0
});
router.get('/stats', requireRoles(['principal']), async (req, res) => {
    const { user } = req;
    if (!user) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const [studentsResponse, staffResponse, classesResponse] = await Promise.all([
            adminSupabase
                .from('students')
                .select('id, status, profile:profiles!students_profile_id_fkey(gender)')
                .eq('school_id', user.schoolId)
                .eq('status', 'active'),
            adminSupabase
                .from('profiles')
                .select('id, gender, role, approval_status')
                .eq('school_id', user.schoolId)
                .in('role', ['principal', 'clerk', 'teacher'])
                .eq('approval_status', 'approved'),
            adminSupabase
                .from('class_groups')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', user.schoolId)
        ]);
        if (studentsResponse.error) {
            console.error('[dashboard] Error fetching students:', studentsResponse.error);
            return res.status(400).json({ error: studentsResponse.error.message });
        }
        if (staffResponse.error) {
            console.error('[dashboard] Error fetching staff:', staffResponse.error);
            return res.status(400).json({ error: staffResponse.error.message });
        }
        if (classesResponse.error) {
            console.error('[dashboard] Error fetching classes:', classesResponse.error);
            return res.status(400).json({ error: classesResponse.error.message });
        }
        const studentGenderCounts = getInitialGenderCounts();
        (studentsResponse.data || []).forEach((student) => {
            const genderKey = normalizeGender(student.profile?.gender);
            studentGenderCounts.total += 1;
            studentGenderCounts[genderKey] += 1;
        });
        const staffGenderCounts = getInitialGenderCounts();
        (staffResponse.data || []).forEach((profile) => {
            const genderKey = normalizeGender(profile.gender);
            staffGenderCounts.total += 1;
            staffGenderCounts[genderKey] += 1;
        });
        const stats = {
            totalStudents: studentGenderCounts.total,
            totalStaff: staffGenderCounts.total,
            totalClasses: classesResponse.count || 0,
            studentsByGender: studentGenderCounts,
            staffByGender: staffGenderCounts
        };
        return res.json({ stats });
    }
    catch (err) {
        console.error('[dashboard] Error building stats:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
