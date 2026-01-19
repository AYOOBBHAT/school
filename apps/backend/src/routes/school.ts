import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Get school information including join code (for principals)
router.get('/info', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  // Use service role key to bypass RLS for consistent access
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Validate schoolId
    if (!user.schoolId) {
      console.warn('[school/info] User has no schoolId. User:', { id: user.id, role: user.role });
      return res.status(400).json({ error: 'User school ID not found' });
    }

    console.log('[school/info] Looking for school with id:', user.schoolId);

    // Get school info for the user's school
    // Use service role client to bypass RLS and use maybeSingle() to handle cases where no school is found gracefully
    const { data: school, error: schoolError } = await adminSupabase
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
      const { data: allSchools, error: checkError } = await adminSupabase
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

