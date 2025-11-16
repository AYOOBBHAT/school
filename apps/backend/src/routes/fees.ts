import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const feeSchema = Joi.object({
  class_group_id: Joi.string().uuid().required(),
  name: Joi.string().required(),
  amount: Joi.number().positive().required(),
  due_date: Joi.string().optional(),
  description: Joi.string().allow('', null)
});

router.get('/', requireRoles(['clerk', 'principal']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('fee_structures')
    .select(`
      id,
      class_group_id,
      name,
      amount,
      due_date,
      description,
      created_at,
      class_groups:class_group_id (
        id,
        name
      )
    `)
    .eq('school_id', user.schoolId)
    .order('due_date', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ fees: data || [] });
});

router.post('/', requireRoles(['clerk', 'principal']), async (req, res) => {
  const { error, value } = feeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const insertPayload = { ...value, school_id: user.schoolId };
  const { data, error: dbError } = await supabase
    .from('fee_structures')
    .insert(insertPayload)
    .select()
    .single();

  if (dbError) return res.status(400).json({ error: dbError.message });
  return res.status(201).json({ fee: data });
});

export default router;


