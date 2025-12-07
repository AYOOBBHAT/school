import { Router } from 'express';
import Joi from 'joi';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const paymentSchema = Joi.object({
  student_id: Joi.string().uuid().required(),
  fee_structure_id: Joi.string().uuid().required(),
  amount_paid: Joi.number().positive().required(),
  payment_mode: Joi.string().valid('cash', 'online', 'upi', 'card').required(),
  transaction_id: Joi.string().allow('', null)
});

router.post('/', requireRoles(['principal']), async (req, res) => {
  const { error, value } = paymentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const payload = {
    ...value,
    received_by: user.id,
    school_id: user.schoolId
  };

  const { data, error: dbError } = await supabase.from('payments').insert(payload).select().single();
  if (dbError) return res.status(400).json({ error: dbError.message });

  // optional log
  await supabase.from('clerk_logs').insert({
    clerk_id: user.id,
    school_id: user.schoolId,
    action: 'payment_recorded',
    entity: 'payment',
    entity_id: data.id
  });

  return res.status(201).json({ payment: data });
});

router.get('/report', requireRoles(['principal']), async (req, res) => {
  const { supabase, user } = req;
  if (!supabase || !user) return res.status(500).json({ error: 'Server misconfigured' });

  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount_paid,
      payment_date,
      payment_mode,
      transaction_id,
      student_id,
      fee_structure_id,
      fee_structures:fee_structure_id (
        id,
        name,
        amount
      ),
      students:student_id (
        id,
        roll_number,
        profile:profiles!students_profile_id_fkey (
          id,
          full_name
        )
      )
    `)
    .eq('school_id', user.schoolId)
    .order('payment_date', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ report: data || [] });
});

export default router;


