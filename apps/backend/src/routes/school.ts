import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

const SCHOOL_SELECT =
  'id, name, join_code, registration_number, address, contact_email, contact_phone, logo_url, created_at';

// Get school information (school_id from profiles table only; no app_metadata)
router.get('/info', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) {
    logger.error('[school/info] Missing supabase or user on request');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const userId = user.id;

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.warn({ userId, code: profileError.code }, '[school/info] Profile fetch failed');
      return res.status(404).json({ error: 'Profile or school not found' });
    }

    if (!profile?.school_id) {
      logger.warn({ userId }, '[school/info] Profile has no school_id');
      return res.status(404).json({ error: 'Profile or school not found' });
    }

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select(SCHOOL_SELECT)
      .eq('id', profile.school_id)
      .single();

    if (schoolError) {
      logger.warn(
        { userId, schoolId: profile.school_id, code: schoolError.code },
        '[school/info] School fetch failed'
      );
      return res.status(404).json({ error: 'School not found' });
    }

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    return res.json({ school });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error({ err, userId }, '[school/info] Unexpected error');
    return res.status(500).json({ error: message });
  }
});

export default router;

