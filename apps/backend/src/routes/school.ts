import { Router } from 'express';
import { requireRoles } from '../middleware/auth';

const router = Router();

// Get school information including join code (for principals)
router.get('/info', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    // Get school info for the user's school
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, join_code, address, contact_email, contact_phone, logo_url, created_at')
      .eq('id', user.schoolId)
      .single();

    if (schoolError) {
      return res.status(400).json({ error: schoolError.message });
    }

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    return res.json({ school });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

