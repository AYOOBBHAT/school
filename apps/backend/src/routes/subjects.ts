import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';

const router = Router();

const subjectSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().allow('', null)
});

// Get all subjects for the school
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    const { data: subjects, error } = await adminSupabase
      .from('subjects')
      .select('id, name, code, description, school_id, created_at')
      .eq('school_id', user.schoolId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[subjects] Error fetching subjects:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ subjects: subjects || [] });
  } catch (err: any) {
    console.error('[subjects] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
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

    return res.status(201).json({ subject });
  } catch (err: any) {
    console.error('[subjects] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

