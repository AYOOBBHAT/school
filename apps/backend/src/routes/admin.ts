import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Get all schools with principal name and total students count
router.get('/schools', requireRoles(['admin']), async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Get all schools with their principals and student counts
    const { data: schools, error: schoolsError } = await adminSupabase
      .from('schools')
      .select(`
        id,
        name,
        address,
        contact_email,
        contact_phone,
        registration_number,
        join_code,
        payment_status,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (schoolsError) {
      console.error('[admin/schools] Error fetching schools:', schoolsError);
      return res.status(400).json({ error: schoolsError.message });
    }

    // Get principals for each school
    const { data: principals, error: principalsError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, full_name, email, phone')
      .eq('role', 'principal');

    if (principalsError) {
      console.error('[admin/schools] Error fetching principals:', principalsError);
      return res.status(400).json({ error: principalsError.message });
    }

    // Get student counts for each school
    const { data: students, error: studentsError } = await adminSupabase
      .from('students')
      .select('school_id, id')
      .eq('status', 'active');

    if (studentsError) {
      console.error('[admin/schools] Error fetching students:', studentsError);
      return res.status(400).json({ error: studentsError.message });
    }

    // Combine data
    const schoolsWithDetails = schools?.map(school => {
      const principal = principals?.find(p => p.school_id === school.id);
      const studentCount = students?.filter(s => s.school_id === school.id).length || 0;

      return {
        id: school.id,
        name: school.name,
        address: school.address,
        contact_email: school.contact_email,
        contact_phone: school.contact_phone,
        registration_number: school.registration_number,
        join_code: school.join_code,
        payment_status: school.payment_status,
        created_at: school.created_at,
        principal: principal ? {
          id: principal.id,
          name: principal.full_name,
          email: principal.email,
          phone: principal.phone
        } : null,
        total_students: studentCount
      };
    }) || [];

    return res.json({
      schools: schoolsWithDetails,
      total: schoolsWithDetails.length
    });
  } catch (err: any) {
    console.error('[admin/schools] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Update school payment status
router.put('/schools/:id/payment-status', requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;

  if (!payment_status || !['paid', 'unpaid'].includes(payment_status)) {
    return res.status(400).json({ error: 'Invalid payment_status. Must be "paid" or "unpaid"' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    const { data: school, error } = await adminSupabase
      .from('schools')
      .update({ payment_status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[admin/schools] Error updating payment status:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    return res.json({
      message: 'Payment status updated successfully',
      school
    });
  } catch (err: any) {
    console.error('[admin/schools] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

