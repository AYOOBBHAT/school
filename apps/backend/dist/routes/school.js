import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
// Get school information including join code (for principals)
router.get('/info', requireRoles(['principal', 'clerk']), async (req, res) => {
    const { supabase, user } = req;
    if (!supabase || !user)
        return res.status(500).json({ error: 'Server misconfigured' });
    try {
        // Validate schoolId
        if (!user.schoolId) {
            console.warn('[school/info] User has no schoolId. User:', { id: user.id, role: user.role });
            return res.status(400).json({ error: 'User school ID not found' });
        }
        console.log('[school/info] Request from user:', {
            userId: user.id,
            role: user.role,
            schoolId: user.schoolId
        });
        // Get school info for the user's school
        // Use user-context Supabase client (from req.supabase) which has the user's JWT token
        // This allows RLS to enforce tenant isolation - auth.uid() and auth.jwt().school_id work correctly
        // The RLS policy will check both JWT claims and profiles table as fallback
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('id, name, join_code, registration_number, address, contact_email, contact_phone, logo_url, created_at')
            .eq('id', user.schoolId)
            .maybeSingle();
        if (schoolError) {
            // Check if this is an RLS denial (permission denied)
            const isRLSDenial = schoolError.message?.toLowerCase().includes('permission') ||
                schoolError.message?.toLowerCase().includes('policy') ||
                schoolError.code === '42501'; // PostgreSQL permission denied error code
            if (isRLSDenial) {
                console.error('[school/info] RLS DENIAL - Access blocked by Row Level Security:', {
                    userId: user.id,
                    role: user.role,
                    schoolId: user.schoolId,
                    error: schoolError.message,
                    code: schoolError.code
                });
                return res.status(403).json({
                    error: 'Access denied',
                    details: 'Row Level Security policy blocked access to school data. Please ensure your account has the correct school_id in app_metadata.'
                });
            }
            console.error('[school/info] Supabase error:', {
                userId: user.id,
                role: user.role,
                schoolId: user.schoolId,
                error: schoolError.message,
                code: schoolError.code
            });
            return res.status(400).json({ error: schoolError.message });
        }
        if (!school) {
            // This could be RLS blocking (no rows returned) or school doesn't exist
            // Check if school exists using a test query to distinguish
            console.warn('[school/info] No school returned. Possible RLS denial or missing school:', {
                userId: user.id,
                role: user.role,
                schoolId: user.schoolId
            });
            // Try to get any schools the user can access (for debugging)
            const { data: accessibleSchools, error: checkError } = await supabase
                .from('schools')
                .select('id, name')
                .limit(5);
            if (!checkError && accessibleSchools && accessibleSchools.length > 0) {
                console.warn('[school/info] User can access other schools (RLS working but wrong school_id):', accessibleSchools.map((s) => ({ id: s.id, name: s.name })));
                return res.status(403).json({
                    error: 'Access denied',
                    details: `Row Level Security blocked access. Your account is associated with a different school.`
                });
            }
            // No schools accessible - likely RLS denial or school doesn't exist
            console.warn('[school/info] RLS DENIAL or school missing - No schools accessible to user');
            return res.status(404).json({
                error: 'School not found or access denied',
                details: `No school found with id: ${user.schoolId}. This may be due to Row Level Security restrictions. Please contact support.`
            });
        }
        console.log('[school/info] School found successfully:', { id: school.id, name: school.name });
        return res.json({ school });
    }
    catch (err) {
        console.error('[school/info] Unexpected error:', {
            userId: user.id,
            role: user.role,
            schoolId: user.schoolId,
            error: err.message,
            stack: err.stack
        });
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
