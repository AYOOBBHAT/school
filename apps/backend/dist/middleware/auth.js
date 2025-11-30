import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export async function authMiddleware(req, res, next) {
    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Supabase credentials not configured' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing bearer token' });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    req.supabase = supabase;
    try {
        // Verify the token and get user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Check if user is admin (admin users have role in user_metadata, not in profiles)
        const userRole = user.user_metadata?.role;
        if (userRole === 'admin') {
            req.user = {
                id: user.id,
                role: 'admin',
                schoolId: null
            };
            return next();
        }
        // Get user profile to get role and school_id
        // Use service role key to bypass RLS for profile lookup
        if (!supabaseServiceKey) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id, role, school_id')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            console.error('[authMiddleware] Error fetching profile:', profileError);
            return res.status(403).json({ error: 'Profile not found' });
        }
        if (!profile.role) {
            return res.status(403).json({ error: 'Invalid profile data' });
        }
        req.user = {
            id: user.id,
            role: profile.role,
            schoolId: profile.school_id
        };
        return next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
}
export function requireRoles(roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthenticated' });
        if (!roles.includes(req.user.role))
            return res.status(403).json({ error: 'Forbidden' });
        return next();
    };
}
// Middleware to check if school has paid subscription
export async function checkPaymentStatus(req, res, next) {
    // Admin users bypass payment check
    if (req.user?.role === 'admin') {
        return next();
    }
    if (!req.user?.schoolId) {
        return res.status(403).json({ error: 'School ID not found' });
    }
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    try {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: school, error } = await adminSupabase
            .from('schools')
            .select('payment_status')
            .eq('id', req.user.schoolId)
            .single();
        if (error || !school) {
            return res.status(400).json({ error: 'School not found' });
        }
        if (school.payment_status !== 'paid') {
            return res.status(402).json({
                error: 'Please pay your remaining dues to access this feature'
            });
        }
        return next();
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to check payment status' });
    }
}
