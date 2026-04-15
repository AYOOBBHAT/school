import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Class groups list for dropdowns/selectors.
 * Multi-school isolation enforced by `user.schoolId`.
 *
 * Response shape is intentionally minimal:
 * { class_groups: [{ id, name }] }
 */
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const { data, error } = await adminSupabase
      .from('class_groups')
      .select('id, name')
      .eq('school_id', user.schoolId)
      .order('name', { ascending: true });

    if (error) {
      logger.error({ err: error, school_id: user.schoolId }, '[class-groups] Error fetching class groups');
      return res.status(400).json({ error: 'Failed to fetch class groups' });
    }

    return res.json({ class_groups: data || [] });
  } catch (err) {
    logger.error({ err }, '[class-groups] Unexpected error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

