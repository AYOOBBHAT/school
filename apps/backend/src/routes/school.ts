import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

// Get school information including join code (for principals)
router.get('/info', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Validate schoolId
    if (!user.schoolId) {
      console.warn('[school/info] User has no schoolId. User:', { id: user.id, role: user.role });
      return res.status(400).json({ error: 'User school ID not found' });
    }

    console.log('[school/info] Looking for school with id:', user.schoolId);

    // Get school info for the user's school
    // Use user-context Supabase client (from req.supabase) which has the user's JWT token
    // This allows RLS to enforce tenant isolation - auth.uid() and auth.jwt().school_id work correctly
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
      // Log more details for debugging
      console.warn('[school/info] School not found for schoolId:', user.schoolId);
      console.warn('[school/info] User details:', { userId: user.id, role: user.role, schoolId: user.schoolId });
      
      // Check if any schools exist at all (for debugging)
      // Note: This will only show schools the user has access to via RLS
      const { data: allSchools, error: checkError } = await supabase
        .from('schools')
        .select('id, name')
        .limit(5);
      
      if (!checkError && allSchools) {
        console.warn('[school/info] Available schools:', allSchools.map((s: any) => ({ id: s.id, name: s.name })));
      }
      
      return res.status(404).json({ 
        error: 'School not found',
        details: `No school found with id: ${user.schoolId}. Please contact support.`
      });
    }

    console.log('[school/info] School found:', { id: school.id, name: school.name });
    return res.json({ school });
  } catch (err: any) {
    console.error('[school/info] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

