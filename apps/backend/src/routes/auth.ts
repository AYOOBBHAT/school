import { Router, type Request } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { generateJoinCode } from '../utils/joinCode.js';
import { sendEmail } from '../utils/email.js';
import { redis, OTP_REDIS_TTL_SECONDS } from '../utils/redis.js';
import logger from '../utils/logger.js';
import { SAFE_INTERNAL_ERROR } from '../utils/safeApiError.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;


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
  const redactBodyForLogs = (body: unknown) => {
    if (body == null || typeof body !== 'object') return body;
    const b = body as Record<string, unknown>;
    const redacted: Record<string, unknown> = { ...b };
    for (const key of ['password', 'new_password', 'otp', 'access_token', 'refresh_token', 'token']) {
      if (key in redacted) redacted[key] = '[REDACTED]';
    }
    return redacted;
  };

  // Debug: log incoming body shape (redacted)
  logger.info({ body: redactBodyForLogs(req.body) }, '[signup-principal] Incoming request body');

  const { error, value } = principalSignupSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true
  });
  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
      type: d.type
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details
    });
  }

  // Check for missing environment variables with specific error messages
  // Service key is validated at module load time in supabaseAdmin.ts

  // Check if service role key is still placeholder
  if (supabaseServiceKey === 'your_service_role_key_here' || supabaseServiceKey.includes('your_service_role_key')) {
    logger.error('[signup-principal] Service role key is still set to placeholder value');
    return res.status(500).json({ error: 'Server configuration error' });
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
        logger.error('[signup-principal] Supabase API key rejected');
        return res.status(400).json({ error: 'Server configuration error' });
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
      return res.status(400).json({ error: 'Failed to create school' });
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
      return res.status(400).json({ error: 'Failed to create profile' });
    }

    // Sign in the user to get a session token
    const anonSupabase = createClient<any>(supabaseUrl, supabaseAnonKey);
    const { data: signInData, error: signInError } = await anonSupabase.auth.signInWithPassword({
      email: value.email,
      password: value.password
    });

    if (signInError || !signInData.session) {
      logger.warn('[signup-principal] Sign-in after signup did not return a session');
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
  } catch (err) {
    logger.error({ err }, '[signup-principal] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
  }
});

// Join existing school with code
router.post('/signup-join', async (req, res) => {
  const { error, value } = joinSignupSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  // Check for missing environment variables with specific error messages
  // Service key is validated at module load time in supabaseAdmin.ts

  // Check if service role key is still placeholder
  if (supabaseServiceKey === 'your_service_role_key_here' || supabaseServiceKey.includes('your_service_role_key')) {
    logger.error('[signup-join] Service role key is still set to placeholder value');
    return res.status(500).json({ error: 'Server configuration error' });
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
        logger.error('[signup-join] Supabase API key rejected');
        return res.status(400).json({ error: 'Server configuration error' });
      }
      return res.status(400).json({ error: authError?.message || 'Failed to create user' });
    }

    // Create profile (approved by default since principals now add users directly)
    const profileData: any = {
      id: authData.user.id,
      role: value.role,
      school_id: school.id,
      full_name: value.full_name,
      email: value.email,
      approval_status: 'approved'
    };

    const { error: profileError } = await supabase.from('profiles').insert(profileData).select();

    if (profileError) {
      logger.warn('[signup-join] Profile insert failed');
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: 'Failed to create profile' });
    }

    // For students: create student record with active status
    if (value.role === 'student') {
      const studentData: any = {
        profile_id: authData.user.id,
        school_id: school.id,
        status: 'active'
      };
      
      if (value.roll_number) {
        studentData.roll_number = value.roll_number;
      }

      const { error: studentError } = await supabase.from('students').insert(studentData);
      
      if (studentError) {
        logger.warn('[signup-join] Student record insert failed');
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

    const redirectMap: Record<string, string> = {
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
  } catch {
    logger.error('[signup-join] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
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
    const anonSupabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
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
      logger.warn('[auth/profile] Profile fetch failed');
      return res.status(400).json({ error: 'Failed to load profile' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Set no-cache headers to prevent caching issues
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.json({ profile });
  } catch {
    logger.error('[auth/profile] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
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
      return res.status(400).json({ error: 'Failed to load schools' });
    }

    return res.json({ schools: schools || [] });
  } catch {
    logger.error('[auth/schools] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
  }
});

// Email-based login endpoint for mobile app
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!supabaseAnonKey) {
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
  }

  try {
    // Sign in with Supabase
    const anonSupabase = createClient<any>(supabaseUrl, supabaseAnonKey);
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
      logger.warn('[login] Profile missing for authenticated user');
      return res.status(400).json({ error: 'User profile not found' });
    }

    // Get school name if school_id exists
    let schoolName: string | undefined;
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
      const appMetadata: any = {};
      if (profile.school_id) appMetadata.school_id = profile.school_id;
      if (profile.role) appMetadata.role = profile.role;

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
        logger.warn('[login] Session refresh with updated claims failed; using prior session');
        // Fall back to original token - user will need to log in again for claims to update
      } else {
        // Use the refreshed session with updated claims
        authData.session = refreshedAuthData.session;
        authData.user = refreshedAuthData.user;
      }
    }

    if (!authData.session) {
      logger.error('[login] No session after sign-in');
      return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
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

    return res.json({
      session,
      user: session.user,
      profile: profilePayload
    });
  } catch {
    logger.error('[login] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
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
    } else if (registration_number) {
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

    // IMPORTANT:
    // `profiles.id` is a FK to `auth.users.id` (see migrations/schema.sql).
    // Do NOT call `listUsers()` (slow and unbounded); treat `profile.id` as the auth user id.

    // Try to sign in with email and password
    const anonSupabase = createClient<any>(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
      email: profile.email,
      password: password
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Get school name if school_id exists
    let schoolName: string | undefined;
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
      const appMetadata: any = {};
      if (profile.school_id) appMetadata.school_id = profile.school_id;
      if (profile.role) appMetadata.role = profile.role;

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
      return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
    }

    const profilePayload = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      schoolId: profile.school_id || '',
      schoolName: schoolName ?? null
    };

    return res.json({
      session,
      user: session.user,
      profile: profilePayload,
      password_reset_required: profile.password_reset_required || false
    });
  } catch {
    logger.error('[login-username] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
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
    const anonSupabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
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
      return res.status(400).json({ error: 'Failed to update password' });
    }

    // Invalidate ALL sessions after password change (all devices)
    const { error: signOutError } = await adminSupabase.auth.admin.signOut(user.id);
    if (signOutError) {
      logger.error({ err: signOutError }, '[reset-password] Failed to revoke sessions');
      return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
    }

    // Update profile to clear password_reset_required flag
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({ password_reset_required: false })
      .eq('id', user.id);

    if (profileError) {
      logger.warn('[reset-password] Profile flag update failed');
    }

    return res.json({
      message: 'Password reset successfully',
      user: { id: updatedUser.user.id }
    });
  } catch {
    logger.error('[reset-password] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
  }
});

// ============================================
// OTP password reset (Upstash Redis, hashed, rate-limited)
// ============================================
// - One OTP per profile: key otp:{profileId}, JSON value, bcrypt hash only, TTL 600s.
// - Request rate limits: otp:rate:{profileId}, optional otp:ip:{ip}.
// - Responses remain generic to prevent account enumeration.

const OTP_MAX_REQUESTS_PER_WINDOW = 3;
const OTP_REQUEST_WINDOW_SECONDS = 600;
const OTP_MAX_ATTEMPTS = 5;
const OTP_BCRYPT_ROUNDS = 12;

type OtpStoredPayload = {
  otp_hash: string;
  type: 'student' | 'email';
  email: string;
  schoolId?: string;
  username?: string;
  attempts: number;
};

/**
 * Upstash `redis.get` may return a parsed object (automaticDeserialization default) even though we
 * `set` JSON.stringify — double JSON.parse throws, which previously wiped the key in catch blocks.
 */
function parseOtpRedisValue(raw: unknown): OtpStoredPayload | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null && typeof (raw as OtpStoredPayload).otp_hash === 'string') {
    const p = raw as OtpStoredPayload;
    if (p.type !== 'student' && p.type !== 'email') return null;
    return p;
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as OtpStoredPayload;
      if (typeof p?.otp_hash !== 'string') return null;
      if (p.type !== 'student' && p.type !== 'email') return null;
      return p;
    } catch {
      return null;
    }
  }
  return null;
}

function otpRedisKey(profileId: string) {
  return `otp:${profileId}`;
}

function otpRateRedisKey(profileId: string) {
  return `otp:rate:${profileId}`;
}

function otpIpRedisKey(ip: string) {
  return `otp:ip:${ip}`;
}

function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function clientOtpIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).split(',')[0].trim();
  }
  const ip = req.ip;
  return typeof ip === 'string' && ip.length > 0 ? ip : undefined;
}

async function enforceOtpRequestRateLimit(profileId: string): Promise<boolean> {
  const key = otpRateRedisKey(profileId);
  const n = await redis.incr(key);
  if (n === 1) {
    await redis.expire(key, OTP_REQUEST_WINDOW_SECONDS);
  }
  return n <= OTP_MAX_REQUESTS_PER_WINDOW;
}

async function enforceOtpIpRateLimit(req: Request): Promise<boolean> {
  const ip = clientOtpIp(req);
  if (!ip) return true;
  const key = otpIpRedisKey(ip);
  const n = await redis.incr(key);
  if (n === 1) {
    await redis.expire(key, OTP_REQUEST_WINDOW_SECONDS);
  }
  return n <= OTP_MAX_REQUESTS_PER_WINDOW;
}

async function storePasswordResetOtp(params: {
  profileId: string;
  type: 'student' | 'email';
  email: string;
  schoolId?: string;
  username?: string;
}): Promise<{ otp: string }> {
  const otp = generateOTP();
  const otp_hash = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
  const value: OtpStoredPayload = {
    otp_hash,
    type: params.type,
    email: params.email,
    schoolId: params.schoolId,
    username: params.username,
    attempts: 0,
  };
  await redis.set(otpRedisKey(params.profileId), JSON.stringify(value), { ex: OTP_REDIS_TTL_SECONDS });
  return { otp };
}

async function incrementOtpAttemptsOrInvalidate(profileId: string): Promise<void> {
  const key = otpRedisKey(profileId);
  const raw = await redis.get(key);
  const parsed = parseOtpRedisValue(raw);
  if (parsed == null) {
    if (raw != null) await redis.del(key);
    return;
  }

  const nextAttempts = (parsed.attempts || 0) + 1;
  if (nextAttempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(key);
    return;
  }

  parsed.attempts = nextAttempts;
  // Fixed TTL — do not reuse redis.ttl(); Upstash/replication quirks can return 0/negative and
  // incorrectly delete the key, making the next verify look "expired" immediately.
  await redis.set(key, JSON.stringify(parsed), { ex: OTP_REDIS_TTL_SECONDS });
}

function otpMatchesRequestContext(
  payload: OtpStoredPayload,
  ctx:
    | { flow: 'student'; username: string; schoolId: string }
    | { flow: 'email'; email: string }
): boolean {
  if (ctx.flow === 'student') {
    return (
      payload.type === 'student' &&
      (payload.username || '').trim() === ctx.username.trim() &&
      payload.schoolId === ctx.schoolId
    );
  }
  return (
    payload.type === 'email' &&
    (payload.email || '').trim().toLowerCase() === ctx.email.trim().toLowerCase()
  );
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
    } else if (registration_number) {
      schoolQuery = schoolQuery.eq('registration_number', registration_number);
    }

    const { data: school, error: schoolError } = await schoolQuery.single();

    if (schoolError || !school) {
      // Don't reveal if school exists for security
      return res.json({ 
        message: 'If a student account exists with this username, an OTP has been sent to the registered email address.' 
      });
    }

    const normalizedUsername = String(username).trim();

    // Find profile by username and school_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('username', normalizedUsername)
      .eq('school_id', school.id)
      .eq('role', 'student')
      .single();

    if (profileError || !profile) {
      // Don't reveal if username exists for security
      return res.json({ 
        message: 'If a student account exists with this username, an OTP has been sent to the registered email address.' 
      });
    }

    // Rate limit OTP requests (Redis). Generic response on limit / IP limit.
    const allowed = await enforceOtpRequestRateLimit(profile.id);
    if (!allowed) {
      return res.json({
        message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
      });
    }
    const ipAllowed = await enforceOtpIpRateLimit(req);
    if (!ipAllowed) {
      return res.json({
        message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
      });
    }

    const otpKey = otpRedisKey(profile.id);
    const existingOtp = await redis.get<string>(otpKey);
    if (existingOtp) {
      return res.json({
        message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
      });
    }

    const { otp } = await storePasswordResetOtp({
      profileId: profile.id,
      type: 'student',
      email: profile.email,
      schoolId: school.id,
      username: normalizedUsername,
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

    // Send OTP via Resend (preferred). If email fails, remove the OTP so we don't leave a usable code behind.
    try {
      await sendEmail({ to: profile.email, subject: emailSubject, text: emailBody });
    } catch (e) {
      await redis.del(otpKey);
    }

    // Always return the same message for security
    return res.json({ 
      message: 'If a student account exists with this username, an OTP has been sent to the registered email address.'
    });
  } catch {
    logger.error('[forgot-password-request] Unexpected error');
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
    const normalizedEmail = String(email).trim().toLowerCase();

    // Find profile by email (principals and teachers have unique emails)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, school_id')
      .eq('email', normalizedEmail)
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

    const allowed = await enforceOtpRequestRateLimit(profile.id);
    if (!allowed) {
      return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
    }
    const ipAllowed = await enforceOtpIpRateLimit(req);
    if (!ipAllowed) {
      return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
    }

    const otpKey = otpRedisKey(profile.id);
    const existingOtpEmail = await redis.get<string>(otpKey);
    if (existingOtpEmail) {
      return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
    }

    const { otp } = await storePasswordResetOtp({
      profileId: profile.id,
      type: 'email',
      email: profile.email,
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

    try {
      await sendEmail({ to: profile.email, subject: emailSubject, text: emailBody });
    } catch (e) {
      await redis.del(otpKey);
    }

    // Always return the same message for security
    return res.json({ 
      message: 'If an account exists with this email, an OTP has been sent.'
    });
  } catch {
    logger.error('[forgot-password-request-email] Unexpected error');
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
    let profileId: string | null = null;
    let resolvedSchoolId: string | undefined;

    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Handle student flow (username-based)
    if (username) {
      if (!username || (!join_code && !registration_number)) {
        return res.status(400).json({ error: 'Username and school code are required for student password reset' });
      }

      // Verify school, then resolve the student profile
      let schoolQuery = supabase
        .from('schools')
        .select('id');

      if (join_code) {
        schoolQuery = schoolQuery.eq('join_code', join_code.toUpperCase());
      } else if (registration_number) {
        schoolQuery = schoolQuery.eq('registration_number', registration_number);
      }

      const { data: school, error: schoolError } = await schoolQuery.single();

      if (schoolError || !school) {
        return res.status(400).json({ error: 'Invalid school code or registration number' });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('username', normalizedUsername)
        .eq('school_id', school.id)
        .eq('role', 'student')
        .single();

      if (profileError || !profile) {
        // Keep errors generic to avoid enumeration.
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      profileId = profile.id;
      resolvedSchoolId = school.id;
    }
    // Handle email flow (principals/teachers)
    else {
      if (!email) {
        return res.status(400).json({ error: 'Email is required for email-based password reset' });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .in('role', ['principal', 'teacher', 'clerk'])
        .single();

      if (profileError || !profile) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      profileId = profile.id;
    }

    if (!profileId) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const otpKey = otpRedisKey(profileId);
    const raw = await redis.get(otpKey);
    const payload = parseOtpRedisValue(raw);
    if (payload == null) {
      if (raw != null) await redis.del(otpKey);
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if ((payload.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      await redis.del(otpKey);
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (username) {
      if (resolvedSchoolId == null) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }
      if (!otpMatchesRequestContext(payload, { flow: 'student', username: normalizedUsername, schoolId: resolvedSchoolId })) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }
    } else if (!email) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    } else if (!otpMatchesRequestContext(payload, { flow: 'email', email: normalizedEmail })) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const otpOk = await bcrypt.compare(String(otp), payload.otp_hash);
    if (!otpOk) {
      await incrementOtpAttemptsOrInvalidate(profileId);
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Prevent parallel verify from reusing the same OTP: delete immediately after a successful compare.
    await redis.del(otpKey);

    // Update password using admin API
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(profileId, {
      password: new_password
    });

    if (updateError) {
      return res.status(400).json({ error: 'Failed to reset password' });
    }

    // Invalidate ALL sessions after password reset (all devices)
    const { error: signOutError } = await supabase.auth.admin.signOut(profileId);
    if (signOutError) {
      logger.error({ err: signOutError }, '[forgot-password-verify] Failed to revoke sessions');
      return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
    }

    // Clear password_reset_required flag
    await supabase
      .from('profiles')
      .update({ password_reset_required: false })
      .eq('id', profileId);

    return res.json({
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch {
    logger.error('[forgot-password-verify] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
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
    // Avoid `listUsers()` (slow + unbounded). Use `profiles` as the source of truth:
    // `profiles.id` == `auth.users.id` and `profiles.email` is stored for lookup.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Confirm the user's email
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
      email_confirm: true
    });

    if (updateError) {
      return res.status(400).json({ error: 'Failed to confirm email' });
    }

    return res.json({
      message: 'Email confirmed successfully',
      user: { id: data.user.id, email: data.user.email }
    });
  } catch {
    logger.error('[confirm-email] Unexpected error');
    return res.status(500).json({ error: SAFE_INTERNAL_ERROR });
  }
});

export default router;


