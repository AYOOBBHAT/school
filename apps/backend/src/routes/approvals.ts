import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const approveSchema = Joi.object({
  profile_id: Joi.string().uuid().required(),
  action: Joi.string().valid('approve', 'reject').required(),
  // For students: class assignment fields
  class_group_id: Joi.string().uuid().allow(null, ''),
  section_id: Joi.string().uuid().allow(null, ''),
  roll_number: Joi.string().allow(null, '')
});

// Get pending approvals
router.get('/pending', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  // Use service role key to bypass RLS policies for admin operations
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Debug: Log the principal's school_id
    console.log('[approvals/pending] Principal school_id:', user.schoolId);
    console.log('[approvals/pending] Principal user:', { id: user.id, role: user.role, schoolId: user.schoolId });

    // First, let's check all profiles for this school to see what we have
    const { data: allProfiles, error: allError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email, role, approval_status, school_id, created_at')
      .eq('school_id', user.schoolId);

    if (allError) {
      console.error('[approvals/pending] Error querying all profiles:', allError);
    } else {
      console.log('[approvals/pending] All profiles for school:', allProfiles?.length || 0, allProfiles);
    }

    // Query pending profiles for the school (bypasses RLS with service role)
    const { data, error } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email, role, created_at, phone, school_id, approval_status')
      .eq('school_id', user.schoolId)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[approvals/pending] Error querying pending profiles:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('[approvals/pending] Found pending profiles:', data?.length || 0, data);
    return res.json({ pending: data || [] });
  } catch (err: any) {
    console.error('[approvals/pending] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Approve or reject a user
router.post('/action', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { error, value } = approveSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  // Use service role key to bypass RLS policies for admin operations
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
    // Verify the profile belongs to the same school and get role (bypasses RLS)
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, school_id, role, approval_status')
      .eq('id', value.profile_id)
      .eq('school_id', user.schoolId)
      .single();

    if (profileError || !profile) {
      console.error('[approvals/action] Profile not found:', profileError);
      return res.status(404).json({ error: 'Profile not found or access denied' });
    }

    // Verify the profile is actually pending approval
    if (profile.approval_status !== 'pending') {
      return res.status(400).json({ error: `Profile is not pending approval. Current status: ${profile.approval_status}` });
    }

    const updateData: any = {
      approval_status: value.action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    };

    console.log('[approvals/action] Updating profile:', {
      profile_id: value.profile_id,
      action: value.action,
      updateData
    });

    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', value.profile_id)
      .select('id, role, approval_status, school_id, full_name, email')
      .single();

    if (updateError) {
      console.error('[approvals/action] Error updating profile:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    console.log('[approvals/action] Profile updated successfully:', updatedProfile);

    // Verify the update was successful
    if (!updatedProfile || updatedProfile.approval_status !== (value.action === 'approve' ? 'approved' : 'rejected')) {
      console.error('[approvals/action] Profile update verification failed:', {
        expected: value.action === 'approve' ? 'approved' : 'rejected',
        actual: updatedProfile?.approval_status
      });
      return res.status(500).json({ error: 'Failed to update approval status' });
    }

    // If approving, also confirm the user's email address
    if (value.action === 'approve') {
      try {
        await adminSupabase.auth.admin.updateUserById(value.profile_id, {
          email_confirm: true
        });
      } catch (err) {
        // Log error but don't fail the approval
        // eslint-disable-next-line no-console
        console.error('[approvals] Failed to confirm email for user:', value.profile_id, err);
      }

      // If approving a student, create/update student record with class assignment
      if (profile.role === 'student') {
        // Verify class_group_id and section_id belong to the school if provided
        if (value.class_group_id) {
          const { data: classGroup, error: classError } = await adminSupabase
            .from('class_groups')
            .select('id, school_id')
            .eq('id', value.class_group_id)
            .eq('school_id', user.schoolId)
            .single();

          if (classError || !classGroup) {
            return res.status(400).json({ error: 'Invalid class group or access denied' });
          }

          // If section_id is provided, verify it belongs to the class_group
          if (value.section_id) {
            const { data: section, error: sectionError } = await adminSupabase
              .from('sections')
              .select('id, class_group_id')
              .eq('id', value.section_id)
              .eq('class_group_id', value.class_group_id)
              .single();

            if (sectionError || !section) {
              return res.status(400).json({ error: 'Invalid section or section does not belong to the class' });
            }
          }
        }

        // Check if student record already exists (created during signup)
        const { data: existingStudent, error: studentCheckError } = await adminSupabase
          .from('students')
          .select('id, status, class_group_id, section_id, roll_number')
          .eq('profile_id', value.profile_id)
          .eq('school_id', user.schoolId)
          .maybeSingle();

        if (studentCheckError && studentCheckError.code !== 'PGRST116') {
          console.error('[approvals/action] Error checking student record:', studentCheckError);
          return res.status(400).json({ error: studentCheckError.message });
        }

        console.log('[approvals/action] Existing student record:', existingStudent);

        const studentData: any = {
          profile_id: value.profile_id,
          school_id: user.schoolId,
          status: 'active' // Activate student when approved
        };

        if (value.class_group_id) {
          studentData.class_group_id = value.class_group_id;
        }
        if (value.section_id) {
          studentData.section_id = value.section_id;
        }
        if (value.roll_number) {
          studentData.roll_number = value.roll_number;
        }

        console.log('[approvals/action] Student data to save:', studentData);

        if (existingStudent) {
          // Update existing student record
          console.log('[approvals/action] Updating existing student record:', existingStudent.id);
          const { data: updatedStudent, error: updateStudentError } = await adminSupabase
            .from('students')
            .update(studentData)
            .eq('id', existingStudent.id)
            .select()
            .single();

          if (updateStudentError) {
            console.error('[approvals/action] Error updating student record:', updateStudentError);
            return res.status(400).json({ error: `Failed to update student record: ${updateStudentError.message}` });
          }

          console.log('[approvals/action] Student record updated successfully:', updatedStudent);
        } else {
          // Create new student record
          console.log('[approvals/action] Creating new student record');
          const { data: newStudent, error: createStudentError } = await adminSupabase
            .from('students')
            .insert(studentData)
            .select()
            .single();

          if (createStudentError) {
            console.error('[approvals/action] Error creating student record:', createStudentError);
            return res.status(400).json({ error: `Failed to create student record: ${createStudentError.message}` });
          }

          console.log('[approvals/action] Student record created successfully:', newStudent);
        }
      }
    }

    return res.json({
      message: `User ${value.action === 'approve' ? 'approved' : 'rejected'}`,
      profile: updatedProfile
    });
  } catch (err: any) {
    console.error('[approvals/action] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;


