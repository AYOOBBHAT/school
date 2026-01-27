import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { cacheFetch, invalidateCache } from '../utils/cache.js';

const router = Router();

const subjectSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().allow('', null)
});

// Get all subjects for the school (CACHED)
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const cacheKey = `school:${user.schoolId}:subjects`;

  try {
    const subjects = await cacheFetch(cacheKey, async () => {
      const { data, error } = await adminSupabase
        .from('subjects')
        .select('id, name, code, school_id, created_at')
        .eq('school_id', user.schoolId)
        .order('name', { ascending: true });

      if (error) {
        console.error('[subjects] Error fetching subjects:', error);
        throw error;
      }

      return data || [];
    });

    return res.json({ subjects });
  } catch (err: any) {
    console.error('[subjects] Error:', err);
    return res.status(400).json({ error: err.message || 'Failed to fetch subjects' });
  }
});

// Create a new subject
router.post('/', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = subjectSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    const { data: subject, error: insertError } = await adminSupabase
      .from('subjects')
      .insert({
        name: value.name,
        code: value.code || null,
        school_id: user.schoolId
      })
      .select()
      .single();

    if (insertError) {
      console.error('[subjects] Error creating subject:', insertError);
      return res.status(400).json({ error: insertError.message });
    }

    // Invalidate cache after creating a subject
    await invalidateCache(`school:${user.schoolId}:subjects`);

    return res.status(201).json({ subject });
  } catch (err: any) {
    console.error('[subjects] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

