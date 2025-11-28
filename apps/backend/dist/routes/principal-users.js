import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Schema for adding student
const addStudentSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    full_name: Joi.string().required(),
    username: Joi.string().required(), // Username must be unique per school
    phone: Joi.string().allow('', null),
    roll_number: Joi.string().allow('', null),
    class_group_id: Joi.string().uuid().allow('', null),
    section_id: Joi.string().uuid().allow('', null),
    admission_date: Joi.string().allow('', null),
    gender: Joi.string().valid('male', 'female', 'other').allow('', null),
    date_of_birth: Joi.string().allow('', null), // ISO date string
    home_address: Joi.string().allow('', null),
    // Parent/Guardian information (mandatory)
    guardian_name: Joi.string().required(),
    guardian_phone: Joi.string().required(),
    guardian_email: Joi.string().email().allow('', null),
    guardian_relationship: Joi.string().default('parent')
});
// Schema for adding staff (clerk or teacher)
const addStaffSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    full_name: Joi.string().required(),
    role: Joi.string().valid('clerk', 'teacher').required(),
    phone: Joi.string().allow('', null),
    gender: Joi.string().valid('male', 'female', 'other').allow('', null)
});
// Check if username is available
router.get('/check-username/:username', requireRoles(['principal']), async (req, res) => {
    const { username } = req.params;
    const { user } = req;
    if (!user || !user.schoolId) {
        return res.status(500).json({ error: 'Server misconfigured' });
    }
    if (!username || username.trim().length === 0) {
        return res.json({ available: false, message: 'Username cannot be empty' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Check if username already exists in this school
        const { data: existingProfile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username.trim())
            .eq('school_id', user.schoolId)
            .maybeSingle();
        if (error) {
            console.error('[check-username] Error checking username:', error);
            return res.status(500).json({ error: 'Failed to check username availability' });
        }
        const available = !existingProfile;
        return res.json({
            available,
            message: available ? 'Username is available' : 'Username already exists'
        });
    }
    catch (err) {
        console.error('[check-username] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Principal adds a student
router.post('/students', requireRoles(['principal']), async (req, res) => {
    const { error, value } = addStudentSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Check if username already exists in this school
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', value.username)
            .eq('school_id', user.schoolId)
            .single();
        if (existingProfile) {
            return res.status(400).json({ error: 'Username already exists in this school. Please choose a different username.' });
        }
        // For students, email can be duplicated within the same school (e.g., siblings)
        // But Supabase Auth requires unique emails globally, so we generate a unique email for auth
        // while storing the original email in the profile
        let authEmail = value.email;
        let emailSuffix = 1;
        // Check if email already exists in auth, and if so, generate a unique one
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some((u) => u.email === authEmail);
        if (emailExists) {
            // Generate unique email for auth: email+username@domain or email.username@domain
            const emailParts = value.email.split('@');
            if (emailParts.length === 2) {
                const [localPart, domain] = emailParts;
                // Use username to make it unique
                authEmail = `${localPart}+${value.username}@${domain}`;
                // If that still exists, add a number
                let stillExists = existingUsers?.users?.some((u) => u.email === authEmail);
                while (stillExists && emailSuffix < 100) {
                    authEmail = `${localPart}+${value.username}${emailSuffix}@${domain}`;
                    stillExists = existingUsers?.users?.some((u) => u.email === authEmail);
                    emailSuffix++;
                }
            }
        }
        // Create auth user with potentially modified email
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: authEmail,
            password: value.password,
            email_confirm: true,
            user_metadata: { role: 'student', school_id: user.schoolId }
        });
        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || 'Failed to create user' });
        }
        // Create profile (auto-approved for principal-added users)
        const profileData = {
            id: authData.user.id,
            role: 'student',
            school_id: user.schoolId,
            full_name: value.full_name,
            email: value.email,
            username: value.username, // Add username
            phone: value.phone || null,
            approval_status: 'approved',
            gender: value.gender || null
        };
        const { error: profileError } = await supabase.from('profiles').insert(profileData);
        if (profileError) {
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: profileError.message });
        }
        // Create student record
        const studentData = {
            profile_id: authData.user.id,
            school_id: user.schoolId,
            status: 'active',
            roll_number: value.roll_number || null,
            admission_date: value.admission_date || null,
            date_of_birth: value.date_of_birth || null,
            home_address: value.home_address || null
        };
        if (value.class_group_id) {
            studentData.class_group_id = value.class_group_id;
        }
        if (value.section_id) {
            studentData.section_id = value.section_id;
        }
        const { data: studentRecord, error: studentError } = await supabase
            .from('students')
            .insert(studentData)
            .select()
            .single();
        if (studentError) {
            await supabase.auth.admin.deleteUser(authData.user.id);
            await supabase.from('profiles').delete().eq('id', authData.user.id);
            return res.status(400).json({ error: `Failed to create student record: ${studentError.message}` });
        }
        // Create parent/guardian profile
        // Generate unique email for guardian if needed
        let guardianAuthEmail = value.guardian_email || `${value.guardian_phone}@guardian.local`;
        const { data: existingGuardianUsers } = await supabase.auth.admin.listUsers();
        const guardianEmailExists = existingGuardianUsers?.users?.some((u) => u.email === guardianAuthEmail);
        if (guardianEmailExists || !value.guardian_email) {
            // Generate unique email
            const emailParts = guardianAuthEmail.split('@');
            if (emailParts.length === 2) {
                const [localPart, domain] = emailParts;
                guardianAuthEmail = `${localPart}+${value.username}_guardian@${domain}`;
                let stillExists = existingGuardianUsers?.users?.some((u) => u.email === guardianAuthEmail);
                let emailSuffix = 1;
                while (stillExists && emailSuffix < 100) {
                    guardianAuthEmail = `${localPart}+${value.username}_guardian${emailSuffix}@${domain}`;
                    stillExists = existingGuardianUsers?.users?.some((u) => u.email === guardianAuthEmail);
                    emailSuffix++;
                }
            }
        }
        // Create guardian auth user
        const { data: guardianAuthData, error: guardianAuthError } = await supabase.auth.admin.createUser({
            email: guardianAuthEmail,
            password: `Guardian${value.guardian_phone.slice(-4)}!`, // Default password based on phone
            email_confirm: true,
            user_metadata: { role: 'parent', school_id: user.schoolId }
        });
        if (guardianAuthError || !guardianAuthData.user) {
            // Log error but continue - guardian can be added later
            console.error('[principal-users] Error creating guardian auth:', guardianAuthError);
        }
        else {
            // Create guardian profile
            const guardianProfileData = {
                id: guardianAuthData.user.id,
                role: 'parent',
                school_id: user.schoolId,
                full_name: value.guardian_name,
                email: value.guardian_email || guardianAuthEmail,
                phone: value.guardian_phone,
                approval_status: 'approved'
            };
            const { error: guardianProfileError } = await supabase
                .from('profiles')
                .insert(guardianProfileData);
            if (guardianProfileError) {
                console.error('[principal-users] Error creating guardian profile:', guardianProfileError);
                // Clean up guardian auth if profile creation fails
                if (guardianAuthData.user) {
                    await supabase.auth.admin.deleteUser(guardianAuthData.user.id);
                }
            }
            else {
                // Link guardian to student
                const { error: guardianLinkError } = await supabase
                    .from('student_guardians')
                    .insert({
                    student_id: studentRecord.id,
                    guardian_profile_id: guardianAuthData.user.id,
                    relationship: value.guardian_relationship || 'parent'
                });
                if (guardianLinkError) {
                    console.error('[principal-users] Error linking guardian to student:', guardianLinkError);
                }
            }
        }
        return res.status(201).json({
            message: 'Student added successfully',
            user: { id: authData.user.id, email: value.email, full_name: value.full_name }
        });
    }
    catch (err) {
        console.error('[principal-users] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Principal adds a staff member (clerk or teacher)
router.post('/staff', requireRoles(['principal']), async (req, res) => {
    const { error, value } = addStaffSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    const { user } = req;
    if (!user || !user.schoolId)
        return res.status(500).json({ error: 'Server misconfigured' });
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Check if email already exists
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const userExists = existingUser?.users?.find((u) => u.email === value.email);
        if (userExists) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: value.email,
            password: value.password,
            email_confirm: true,
            user_metadata: { role: value.role, school_id: user.schoolId }
        });
        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || 'Failed to create user' });
        }
        // Create profile (auto-approved for principal-added users)
        const profileData = {
            id: authData.user.id,
            role: value.role, // clerk or teacher
            school_id: user.schoolId,
            full_name: value.full_name,
            email: value.email,
            phone: value.phone || null,
            approval_status: 'approved',
            gender: value.gender || null
        };
        const { error: profileError } = await supabase.from('profiles').insert(profileData);
        if (profileError) {
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: profileError.message });
        }
        return res.status(201).json({
            message: `${value.role === 'clerk' ? 'Clerk' : 'Teacher'} added successfully`,
            user: { id: authData.user.id, email: value.email, full_name: value.full_name, role: value.role }
        });
    }
    catch (err) {
        console.error('[principal-users] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
