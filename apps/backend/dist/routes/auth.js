import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { generateJoinCode } from '../utils/joinCode.js';
const router = Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Principal signup schema
const principalSignupSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    full_name: Joi.string().required(),
    phone: Joi.string().required(),
    school_name: Joi.string().required(),
    school_registration_number: Joi.string().required(),
    school_address: Joi.string().allow('', null),
    contact_phone: Joi.string().allow('', null),
    contact_email: Joi.string().email().allow('', null)
});
// Join school signup schema
const joinSignupSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    full_name: Joi.string().required(),
    role: Joi.string().valid('clerk', 'teacher', 'student', 'parent').required(),
    join_code: Joi.string().required(),
    roll_number: Joi.string().allow('', null), // For students
    child_student_id: Joi.string().uuid().allow('', null) // For parents
});
// Principal creates school
router.post('/signup-principal', async (req, res) => {
    const { error, value } = principalSignupSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    // Check for missing environment variables with specific error messages
    if (!supabaseUrl || !supabaseServiceKey) {
        const missing = [];
        if (!supabaseUrl)
            missing.push('SUPABASE_URL');
        if (!supabaseServiceKey)
            missing.push('SUPABASE_SERVICE_ROLE_KEY');
        // eslint-disable-next-line no-console
        console.error(`[signup-principal] Missing environment variables: ${missing.join(', ')}`);
        return res.status(500).json({
            error: `Server configuration error: Missing required environment variables: ${missing.join(', ')}. Please ensure these are set in your .env file.`
        });
    }
    // Check if service role key is still placeholder
    if (supabaseServiceKey === 'your_service_role_key_here' || supabaseServiceKey.includes('your_service_role_key')) {
        // eslint-disable-next-line no-console
        console.error('[signup-principal] Service role key is still set to placeholder value');
        return res.status(500).json({
            error: 'Invalid API key: Please replace the placeholder SUPABASE_SERVICE_ROLE_KEY in your .env file with your actual Supabase service role key from the dashboard (Settings > API > service_role key).'
        });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Create auth user with email confirmed (no email confirmation required)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: value.email,
            password: value.password,
            email_confirm: true, // Auto-confirm email for admin-created users
            user_metadata: { role: 'principal' }
        });
        if (authError || !authData.user) {
            // Provide more helpful error message for invalid API key
            if (authError?.message?.toLowerCase().includes('invalid') && authError?.message?.toLowerCase().includes('api key')) {
                // eslint-disable-next-line no-console
                console.error('[signup-principal] Supabase API key error:', authError.message);
                return res.status(400).json({
                    error: 'Invalid API key. Please check your SUPABASE_SERVICE_ROLE_KEY in the .env file. Get it from Supabase Dashboard > Settings > API > service_role key.'
                });
            }
            return res.status(400).json({ error: authError?.message || 'Failed to create user' });
        }
        // Check if registration number already exists
        const { data: existingSchool } = await supabase
            .from('schools')
            .select('id')
            .eq('registration_number', value.school_registration_number)
            .single();
        if (existingSchool) {
            return res.status(400).json({ error: 'School registration number already exists. Please use a different registration number.' });
        }
        // Generate join code
        const joinCode = generateJoinCode();
        // Create school
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .insert({
            name: value.school_name,
            address: value.school_address,
            registration_number: value.school_registration_number,
            contact_phone: value.contact_phone,
            contact_email: value.contact_email,
            join_code: joinCode
        })
            .select()
            .single();
        if (schoolError || !school) {
            // Rollback: delete user
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: schoolError?.message || 'Failed to create school' });
        }
        // Update user metadata with school_id
        await supabase.auth.admin.updateUserById(authData.user.id, {
            user_metadata: { role: 'principal', school_id: school.id }
        });
        // Create profile (principal is auto-approved)
        const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            role: 'principal',
            school_id: school.id,
            full_name: value.full_name,
            email: value.email,
            phone: value.phone,
            approval_status: 'approved'
        });
        if (profileError) {
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: profileError.message });
        }
        return res.status(201).json({
            user: { id: authData.user.id, email: value.email },
            school: { id: school.id, name: school.name, join_code: joinCode },
            redirect: '/principal/dashboard'
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[signup-principal] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Join existing school with code
router.post('/signup-join', async (req, res) => {
    const { error, value } = joinSignupSchema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.message });
    // Check for missing environment variables with specific error messages
    if (!supabaseUrl || !supabaseServiceKey) {
        const missing = [];
        if (!supabaseUrl)
            missing.push('SUPABASE_URL');
        if (!supabaseServiceKey)
            missing.push('SUPABASE_SERVICE_ROLE_KEY');
        // eslint-disable-next-line no-console
        console.error(`[signup-join] Missing environment variables: ${missing.join(', ')}`);
        return res.status(500).json({
            error: `Server configuration error: Missing required environment variables: ${missing.join(', ')}. Please ensure these are set in your .env file.`
        });
    }
    // Check if service role key is still placeholder
    if (supabaseServiceKey === 'your_service_role_key_here' || supabaseServiceKey.includes('your_service_role_key')) {
        // eslint-disable-next-line no-console
        console.error('[signup-join] Service role key is still set to placeholder value');
        return res.status(500).json({
            error: 'Invalid API key: Please replace the placeholder SUPABASE_SERVICE_ROLE_KEY in your .env file with your actual Supabase service role key from the dashboard (Settings > API > service_role key).'
        });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Find school by join code
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('id')
            .eq('join_code', value.join_code.toUpperCase())
            .single();
        if (schoolError || !school) {
            return res.status(404).json({ error: 'Invalid join code' });
        }
        // Create auth user with email confirmed (no email confirmation required)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: value.email,
            password: value.password,
            email_confirm: true, // Auto-confirm email for admin-created users
            user_metadata: { role: value.role, school_id: school.id }
        });
        if (authError || !authData.user) {
            // Provide more helpful error message for invalid API key
            if (authError?.message?.toLowerCase().includes('invalid') && authError?.message?.toLowerCase().includes('api key')) {
                // eslint-disable-next-line no-console
                console.error('[signup-join] Supabase API key error:', authError.message);
                return res.status(400).json({
                    error: 'Invalid API key. Please check your SUPABASE_SERVICE_ROLE_KEY in the .env file. Get it from Supabase Dashboard > Settings > API > service_role key.'
                });
            }
            return res.status(400).json({ error: authError?.message || 'Failed to create user' });
        }
        // Create profile (pending approval)
        const profileData = {
            id: authData.user.id,
            role: value.role,
            school_id: school.id,
            full_name: value.full_name,
            email: value.email,
            approval_status: 'pending'
        };
        console.log('[signup-join] Creating profile with data:', {
            id: profileData.id,
            role: profileData.role,
            school_id: profileData.school_id,
            approval_status: profileData.approval_status,
            email: profileData.email
        });
        const { error: profileError, data: profileDataResult } = await supabase.from('profiles').insert(profileData).select();
        if (profileError) {
            console.error('[signup-join] Error creating profile:', profileError);
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: profileError.message });
        }
        console.log('[signup-join] Profile created successfully:', profileDataResult);
        // For students: always create student record with pending status (will be activated on approval)
        if (value.role === 'student') {
            const studentData = {
                profile_id: authData.user.id,
                school_id: school.id,
                status: 'pending' // Student status is pending until approved by principal
            };
            if (value.roll_number) {
                studentData.roll_number = value.roll_number;
            }
            const { error: studentError } = await supabase.from('students').insert(studentData);
            if (studentError) {
                // Log error but don't fail the signup - student record can be created during approval
                // eslint-disable-next-line no-console
                console.error('[signup-join] Error creating student record:', studentError);
            }
        }
        // For parents: link to child if provided
        if (value.role === 'parent' && value.child_student_id) {
            await supabase.from('student_guardians').insert({
                student_id: value.child_student_id,
                guardian_profile_id: authData.user.id,
                relationship: 'parent'
            });
        }
        const redirectMap = {
            clerk: '/clerk/fees',
            teacher: '/teacher/classes',
            student: '/student/home',
            parent: '/parent/home'
        };
        return res.status(201).json({
            user: { id: authData.user.id, email: value.email },
            message: 'Account created. Waiting for approval from school administrator.',
            redirect: redirectMap[value.role] || '/pending-approval',
            approval_required: true
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[signup-join] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Get current user's profile (for login status check - bypasses RLS)
router.get('/profile', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing bearer token' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    try {
        // Verify the token and get user
        const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });
        const { data: { user }, error: userError } = await anonSupabase.auth.getUser();
        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Get profile using service role to bypass RLS
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, role, approval_status, school_id, full_name, email, created_at')
            .eq('id', user.id)
            .single();
        if (profileError) {
            // eslint-disable-next-line no-console
            console.error('[auth/profile] Error fetching profile:', profileError);
            return res.status(400).json({ error: profileError.message });
        }
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        // eslint-disable-next-line no-console
        console.log('[auth/profile] Profile fetched:', { id: profile.id, role: profile.role, approval_status: profile.approval_status });
        // Set no-cache headers to prevent caching issues
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.json({ profile });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth/profile] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Public endpoint to get list of all schools for signup dropdown
router.get('/schools', async (req, res) => {
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Get all schools (public information for signup)
        const { data: schools, error: schoolsError } = await supabase
            .from('schools')
            .select('id, name, join_code, address, contact_email, contact_phone')
            .order('name', { ascending: true });
        if (schoolsError) {
            return res.status(400).json({ error: schoolsError.message });
        }
        return res.json({ schools: schools || [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth/schools] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Username-based login for students
router.post('/login-username', async (req, res) => {
    const { username, password, join_code, registration_number } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (!join_code && !registration_number) {
        return res.status(400).json({ error: 'Either join code or registration number is required' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Find school by join_code or registration_number
        let schoolQuery = supabase
            .from('schools')
            .select('id');
        if (join_code) {
            schoolQuery = schoolQuery.eq('join_code', join_code.toUpperCase());
        }
        else if (registration_number) {
            schoolQuery = schoolQuery.eq('registration_number', registration_number);
        }
        const { data: school, error: schoolError } = await schoolQuery.single();
        if (schoolError || !school) {
            return res.status(401).json({ error: 'Invalid school code or registration number' });
        }
        // Find profile by username and school_id
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, role, password_reset_required, school_id')
            .eq('username', username)
            .eq('school_id', school.id)
            .eq('role', 'student')
            .single();
        if (profileError || !profile) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // Get the auth user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            return res.status(400).json({ error: listError.message });
        }
        const authUser = users.find(u => u.email === profile.email);
        if (!authUser) {
            return res.status(404).json({ error: 'User account not found' });
        }
        // Try to sign in with email and password
        const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
            email: profile.email,
            password: password
        });
        if (authError || !authData.user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        return res.json({
            user: { id: authData.user.id, email: profile.email },
            session: authData.session,
            password_reset_required: profile.password_reset_required || false
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[login-username] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Password reset for first-time student login
router.post('/reset-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing bearer token' });
    }
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
        return res.status(400).json({ error: 'New password is required and must be at least 8 characters' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    try {
        // Verify the token and get user
        const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });
        const { data: { user }, error: userError } = await anonSupabase.auth.getUser();
        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Update password using admin API
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: updatedUser, error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
            password: new_password
        });
        if (updateError) {
            return res.status(400).json({ error: updateError.message });
        }
        // Update profile to clear password_reset_required flag
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .update({ password_reset_required: false })
            .eq('id', user.id);
        if (profileError) {
            // eslint-disable-next-line no-console
            console.error('[reset-password] Error updating profile:', profileError);
            // Don't fail the request if profile update fails
        }
        return res.json({
            message: 'Password reset successfully',
            user: { id: updatedUser.user.id }
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[reset-password] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// Utility endpoint to confirm email for existing users (for fixing users created before email_confirm fix)
// This should be called with service role key or removed after fixing existing users
router.post('/confirm-email', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Find user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            return res.status(400).json({ error: listError.message });
        }
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Confirm the user's email
        const { data, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            email_confirm: true
        });
        if (updateError) {
            return res.status(400).json({ error: updateError.message });
        }
        return res.json({
            message: 'Email confirmed successfully',
            user: { id: data.user.id, email: data.user.email }
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[confirm-email] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
