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
    phone: Joi.string().allow('', null),
    roll_number: Joi.string().allow('', null),
    class_group_id: Joi.string().uuid().allow('', null),
    section_id: Joi.string().uuid().allow('', null),
    admission_date: Joi.string().allow('', null),
    gender: Joi.string().valid('male', 'female', 'other').allow('', null)
});
// Schema for adding teacher
const addTeacherSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    full_name: Joi.string().required(),
    phone: Joi.string().allow('', null),
    gender: Joi.string().valid('male', 'female', 'other').allow('', null)
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
            admission_date: value.admission_date || null
        };
        if (value.class_group_id) {
            studentData.class_group_id = value.class_group_id;
        }
        if (value.section_id) {
            studentData.section_id = value.section_id;
        }
        const { error: studentError } = await supabase.from('students').insert(studentData);
        if (studentError) {
            // Log error but don't fail - student record can be updated later
            console.error('[principal-users] Error creating student record:', studentError);
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
// Principal adds a teacher
router.post('/teachers', requireRoles(['principal']), async (req, res) => {
    const { error, value } = addTeacherSchema.validate(req.body);
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
            user_metadata: { role: 'teacher', school_id: user.schoolId }
        });
        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || 'Failed to create user' });
        }
        // Create profile (auto-approved for principal-added users)
        const profileData = {
            id: authData.user.id,
            role: 'teacher',
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
            message: 'Teacher added successfully',
            user: { id: authData.user.id, email: value.email, full_name: value.full_name }
        });
    }
    catch (err) {
        console.error('[principal-users] Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
export default router;
