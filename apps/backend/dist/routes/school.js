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
            return res.status(400).json({ error: 'User school ID not found' });
        }
        // Get school info for the user's school
        // Use maybeSingle() to handle cases where no school is found gracefully
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('id, name, join_code, registration_number, address, contact_email, contact_phone, logo_url, created_at')
            .eq('id', user.schoolId)
            .maybeSingle();
        if (schoolError) {
            console.error('[school/info] Supabase error:', schoolError);
            return res.status(400).json({ error: schoolError.message });
        }
        if (!school) {
            console.warn('[school/info] School not found for schoolId:', user.schoolId);
            return res.status(404).json({ error: 'School not found' });
        }
        return res.json({ school });
    }
    catch (err) {
        console.error('[school/info] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
