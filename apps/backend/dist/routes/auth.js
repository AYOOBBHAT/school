import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
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
    // Service key is validated at module load time in supabaseAdmin.ts
    // Check if service role key is still placeholder
    if (supabaseServiceKey === 'your_service_role_key_here' || supabaseServiceKey.includes('your_service_role_key')) {
        // eslint-disable-next-line no-console
        console.error('[signup-principal] Service role key is still set to placeholder value');
        return res.status(500).json({
            error: 'Invalid API key: Please replace the placeholder SUPABASE_SERVICE_ROLE_KEY in your .env file with your actual Supabase service role key from the dashboard (Settings > API > service_role key).'
        });
    }
    const supabase = adminSupabase;
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
        // Use principal's email and phone as school contact if not provided separately
        const schoolContactEmail = value.contact_email || value.email;
        const schoolContactPhone = value.contact_phone || value.phone;
        // Create school (marked as paid by default)
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .insert({
            name: value.school_name,
            address: value.school_address,
            registration_number: value.school_registration_number,
            contact_phone: schoolContactPhone,
            contact_email: schoolContactEmail,
            join_code: joinCode,
            payment_status: 'paid' // New schools are considered paid
        })
            .select()
            .single();
        if (schoolError || !school) {
            // Rollback: delete user
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: schoolError?.message || 'Failed to create school' });
        }
        // Update user metadata with school_id, phone, and full_name
        await supabase.auth.admin.updateUserById(authData.user.id, {
            user_metadata: {
                role: 'principal',
                school_id: school.id,
                phone: value.phone,
                full_name: value.full_name
            }
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
        // Sign in the user to get a session token
        const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: signInData, error: signInError } = await anonSupabase.auth.signInWithPassword({
            email: value.email,
            password: value.password
        });
        if (signInError || !signInData.session) {
            // eslint-disable-next-line no-console
            console.error('[signup-principal] Error signing in user after signup:', signInError);
            return res.status(201).json({
                user: { id: authData.user.id, email: value.email },
                school: { id: school.id, name: school.name, join_code: joinCode },
                session: null,
                redirect: '/principal/dashboard'
            });
        }
        const session = signInData.session;
        const profilePayload = {
            id: authData.user.id,
            email: value.email,
            role: 'principal',
            full_name: value.full_name,
            schoolId: school.id,
            schoolName: school.name
        };
        return res.status(201).json({
            session,
            user: session.user,
            profile: profilePayload,
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
    // Service key is validated at module load time in supabaseAdmin.ts
    // Check if service role key is still placeholder
    if (supabaseServiceKey === 'your_service_role_key_here' || supabaseServiceKey.includes('your_service_role_key')) {
        // eslint-disable-next-line no-console
        console.error('[signup-join] Service role key is still set to placeholder value');
        return res.status(500).json({
            error: 'Invalid API key: Please replace the placeholder SUPABASE_SERVICE_ROLE_KEY in your .env file with your actual Supabase service role key from the dashboard (Settings > API > service_role key).'
        });
    }
    const supabase = adminSupabase;
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
        // Create profile (approved by default since principals now add users directly)
        const profileData = {
            id: authData.user.id,
            role: value.role,
            school_id: school.id,
            full_name: value.full_name,
            email: value.email,
            approval_status: 'approved'
        };
        console.log('[signup-join] Creating profile with data:', {
            id: profileData.id,
            role: profileData.role,
            school_id: profileData.school_id,
            email: profileData.email
        });
        const { error: profileError, data: profileDataResult } = await supabase.from('profiles').insert(profileData).select();
        if (profileError) {
            console.error('[signup-join] Error creating profile:', profileError);
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ error: profileError.message });
        }
        console.log('[signup-join] Profile created successfully:', profileDataResult);
        // For students: create student record with active status
        if (value.role === 'student') {
            const studentData = {
                profile_id: authData.user.id,
                school_id: school.id,
                status: 'active'
            };
            if (value.roll_number) {
                studentData.roll_number = value.roll_number;
            }
            const { error: studentError } = await supabase.from('students').insert(studentData);
            if (studentError) {
                // Log error but don't fail the signup
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
            message: 'Account created successfully.',
            redirect: redirectMap[value.role] || '/login'
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
    // Service key is validated at module load time in supabaseAdmin.ts
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
    // Service key is validated at module load time in supabaseAdmin.ts
    const supabase = adminSupabase;
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
// Email-based login endpoint for mobile app
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!supabaseAnonKey) {
        return res.status(500).json({ error: 'Missing SUPABASE_ANON_KEY' });
    }
    try {
        // Sign in with Supabase
        const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
            email,
            password
        });
        if (authError || !authData.user || !authData.session) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Get user profile
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, role, full_name, email, school_id')
            .eq('id', authData.user.id)
            .single();
        if (profileError || !profile) {
            // eslint-disable-next-line no-console
            console.error('[login] Error fetching profile:', profileError);
            return res.status(400).json({ error: 'User profile not found' });
        }
        // Get school name if school_id exists
        let schoolName;
        if (profile.school_id) {
            const { data: school } = await adminSupabase
                .from('schools')
                .select('name')
                .eq('id', profile.school_id)
                .single();
            schoolName = school?.name;
        }
        // Update app_metadata with school_id and role so they become JWT custom claims
        // This allows RLS policies using auth_claim('school_id') and auth_claim('role') to work
        if (profile.school_id || profile.role) {
            const appMetadata = {};
            if (profile.school_id)
                appMetadata.school_id = profile.school_id;
            if (profile.role)
                appMetadata.role = profile.role;
            await adminSupabase.auth.admin.updateUserById(authData.user.id, {
                app_metadata: appMetadata
            });
            // Sign out and sign in again to get a fresh token with updated claims
            // This ensures the JWT includes the new app_metadata immediately
            await anonSupabase.auth.signOut();
            const { data: refreshedAuthData, error: refreshError } = await anonSupabase.auth.signInWithPassword({
                email,
                password
            });
            if (refreshError || !refreshedAuthData.session) {
                // eslint-disable-next-line no-console
                console.warn('[login] Failed to refresh session with new claims, using original token:', refreshError);
                // Fall back to original token - user will need to log in again for claims to update
            }
            else {
                // Use the refreshed session with updated claims
                authData.session = refreshedAuthData.session;
                authData.user = refreshedAuthData.user;
            }
        }
        if (!authData.session) {
            // eslint-disable-next-line no-console
            console.error('[login] No session!');
            return res.status(500).json({ error: 'Failed to generate authentication session' });
        }
        const session = authData.session;
        const profilePayload = {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            full_name: profile.full_name,
            schoolId: profile.school_id || '',
            schoolName: schoolName ?? null
        };
        // eslint-disable-next-line no-console
        console.log('[login] Login successful:', {
            userId: session.user.id,
            email: session.user.email,
            hasSession: !!session
        });
        return res.json({
            session,
            user: session.user,
            profile: profilePayload
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[login] Error:', err);
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
    // Service key is validated at module load time in supabaseAdmin.ts
    const supabase = adminSupabase;
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
            .select('id, email, role, password_reset_required, school_id, full_name')
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
        // Get school name if school_id exists
        let schoolName;
        if (profile.school_id) {
            const { data: schoolData } = await supabase
                .from('schools')
                .select('name')
                .eq('id', profile.school_id)
                .single();
            schoolName = schoolData?.name;
        }
        // Update app_metadata with school_id and role so they become JWT custom claims
        if (profile.school_id || profile.role) {
            const appMetadata = {};
            if (profile.school_id)
                appMetadata.school_id = profile.school_id;
            if (profile.role)
                appMetadata.role = profile.role;
            await supabase.auth.admin.updateUserById(authData.user.id, {
                app_metadata: appMetadata
            });
            // Sign out and sign in again to get a fresh token with updated claims
            await anonSupabase.auth.signOut();
            const { data: refreshedAuthData, error: refreshError } = await anonSupabase.auth.signInWithPassword({
                email: profile.email,
                password
            });
            if (!refreshError && refreshedAuthData.session) {
                authData.session = refreshedAuthData.session;
                authData.user = refreshedAuthData.user;
            }
        }
        const session = authData.session;
        if (!session) {
            return res.status(500).json({ error: 'Failed to generate authentication session' });
        }
        const profilePayload = {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            full_name: profile.full_name,
            schoolId: profile.school_id || '',
            schoolName: schoolName ?? null
        };
        // eslint-disable-next-line no-console
        console.log('[login-username] Login successful:', {
            userId: session.user.id,
            hasSession: !!session
        });
        return res.json({
            session,
            user: session.user,
            profile: profilePayload,
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
    // Service key is validated at module load time in supabaseAdmin.ts
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
const otpStore = new Map();
// Clean up expired OTPs every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [otp, data] of otpStore.entries()) {
        if (data.expiresAt < now) {
            otpStore.delete(otp);
        }
    }
}, 5 * 60 * 1000);
// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Forgot password - Request OTP
router.post('/forgot-password-request', async (req, res) => {
    const { username, join_code, registration_number } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }
    if (!join_code && !registration_number) {
        return res.status(400).json({ error: 'Either join code or registration number is required' });
    }
    // Service key is validated at module load time in supabaseAdmin.ts
    const supabase = adminSupabase;
    try {
        // Find school by join_code or registration_number
        let schoolQuery = supabase
            .from('schools')
            .select('id, name');
        if (join_code) {
            schoolQuery = schoolQuery.eq('join_code', join_code.toUpperCase());
        }
        else if (registration_number) {
            schoolQuery = schoolQuery.eq('registration_number', registration_number);
        }
        const { data: school, error: schoolError } = await schoolQuery.single();
        if (schoolError || !school) {
            // Don't reveal if school exists for security
            return res.json({
                message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
            });
        }
        // Find profile by username and school_id
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, role, full_name')
            .eq('username', username.trim())
            .eq('school_id', school.id)
            .eq('role', 'student')
            .single();
        if (profileError || !profile) {
            // Don't reveal if username exists for security
            return res.json({
                message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
            });
        }
        // Generate OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        // Store OTP
        otpStore.set(otp, {
            username: username.trim(),
            schoolId: school.id,
            email: profile.email,
            profileId: profile.id,
            expiresAt,
            type: 'student'
        });
        // Send OTP via email using Supabase's email service
        // Note: This requires Supabase email templates to be configured
        // For now, we'll use a simple approach - in production, use a proper email service
        const emailSubject = `Password Reset OTP - ${school.name}`;
        const emailBody = `
Hello ${profile.full_name},

You have requested to reset your password for your student account.

Your OTP code is: ${otp}

This code will expire in 10 minutes.

If you did not request this password reset, please ignore this email.

Best regards,
${school.name}
    `;
        // Use Supabase's email sending (requires email templates to be set up)
        // For development, you might want to log the OTP instead
        // eslint-disable-next-line no-console
        console.log(`[OTP for ${profile.email}]: ${otp}`);
        // Try to send email via Supabase
        try {
            // You can use Supabase's email functionality here
            // For now, we'll just return success (OTP is logged for development)
            // In production, integrate with an email service like SendGrid, AWS SES, etc.
        }
        catch (emailError) {
            // eslint-disable-next-line no-console
            console.error('[forgot-password-request] Error sending email:', emailError);
        }
        // Always return the same message for security
        return res.json({
            message: 'If a student account exists with this username, an OTP has been sent to the registered email address.',
            // In development, you might want to return the OTP for testing
            // Remove this in production!
            ...(process.env.NODE_ENV === 'development' && { otp })
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[forgot-password-request] Error:', err);
        // Return generic message for security
        return res.json({
            message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
        });
    }
});
// Forgot password - Request OTP (Email-based for principals/teachers)
router.post('/forgot-password-request-email', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    // Service key is validated at module load time in supabaseAdmin.ts
    const supabase = adminSupabase;
    try {
        // Find profile by email (principals and teachers have unique emails)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, role, full_name, school_id')
            .eq('email', email.trim().toLowerCase())
            .in('role', ['principal', 'teacher', 'clerk'])
            .single();
        if (profileError || !profile) {
            // Don't reveal if email exists for security
            return res.json({
                message: 'If an account exists with this email, an OTP has been sent.'
            });
        }
        // Get school name for email
        const { data: school } = await supabase
            .from('schools')
            .select('name')
            .eq('id', profile.school_id)
            .single();
        // Generate OTP
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        // Store OTP
        otpStore.set(otp, {
            email: profile.email,
            profileId: profile.id,
            expiresAt,
            type: 'email'
        });
        // Send OTP via email
        const emailSubject = `Password Reset OTP${school?.name ? ` - ${school.name}` : ''}`;
        const emailBody = `
Hello ${profile.full_name},

You have requested to reset your password for your ${profile.role} account.

Your OTP code is: ${otp}

This code will expire in 10 minutes.

If you did not request this password reset, please ignore this email.

Best regards,
School Management System
    `;
        // eslint-disable-next-line no-console
        console.log(`[OTP for ${profile.email}]: ${otp}`);
        // Always return the same message for security
        return res.json({
            message: 'If an account exists with this email, an OTP has been sent.',
            // In development, you might want to return the OTP for testing
            // Remove this in production!
            ...(process.env.NODE_ENV === 'development' && { otp })
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[forgot-password-request-email] Error:', err);
        // Return generic message for security
        return res.json({
            message: 'If an account exists with this email, an OTP has been sent.'
        });
    }
});
// Forgot password - Verify OTP and Reset Password (handles both student and email flows)
router.post('/forgot-password-verify', async (req, res) => {
    const { username, join_code, registration_number, email, otp, new_password } = req.body;
    if (!otp || !new_password) {
        return res.status(400).json({ error: 'OTP and new password are required' });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    // Service key is validated at module load time in supabaseAdmin.ts
    const supabase = adminSupabase;
    try {
        // Verify OTP
        const otpData = otpStore.get(otp);
        if (!otpData) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        if (otpData.expiresAt < Date.now()) {
            otpStore.delete(otp);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }
        // Handle student flow (username-based)
        if (otpData.type === 'student') {
            if (!username || (!join_code && !registration_number)) {
                return res.status(400).json({ error: 'Username and school code are required for student password reset' });
            }
            // Verify username matches
            if (otpData.username !== username.trim()) {
                return res.status(400).json({ error: 'Invalid OTP for this username' });
            }
            // Verify school
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
            if (schoolError || !school || school.id !== otpData.schoolId) {
                return res.status(400).json({ error: 'Invalid school code or registration number' });
            }
        }
        // Handle email flow (principals/teachers)
        else if (otpData.type === 'email') {
            if (!email) {
                return res.status(400).json({ error: 'Email is required for email-based password reset' });
            }
            // Verify email matches
            if (otpData.email.toLowerCase() !== email.trim().toLowerCase()) {
                return res.status(400).json({ error: 'Invalid OTP for this email' });
            }
        }
        // Update password using admin API
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(otpData.profileId, {
            password: new_password
        });
        if (updateError) {
            return res.status(400).json({ error: updateError.message || 'Failed to reset password' });
        }
        // Clear password_reset_required flag
        await supabase
            .from('profiles')
            .update({ password_reset_required: false })
            .eq('id', otpData.profileId);
        // Delete used OTP
        otpStore.delete(otp);
        return res.json({
            message: 'Password reset successfully. You can now login with your new password.'
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('[forgot-password-verify] Error:', err);
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
    // Service key is validated at module load time in supabaseAdmin.ts
    const supabase = adminSupabase;
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
