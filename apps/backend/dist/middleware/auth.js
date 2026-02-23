import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function extractBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice(7).trim();
    return token || null;
}
export async function authMiddleware(req, res, next) {
    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Supabase credentials not configured' });
    }
    const token = extractBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Missing bearer token' });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = data.user;
    if (user.user_metadata?.role === 'admin') {
        req.user = { id: user.id, role: 'admin', schoolId: null };
        return next();
    }
    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id, role, school_id')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError) {
        return res.status(403).json({ error: 'Profile not found' });
    }
    if (!profile?.role) {
        return res.status(403).json({ error: 'Profile not found' });
    }
    req.user = {
        id: user.id,
        role: profile.role,
        schoolId: profile.school_id ?? null
    };
    req.supabase = supabase;
    return next();
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
export async function checkPaymentStatus(req, res, next) {
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
    catch {
        return res.status(500).json({ error: 'Failed to check payment status' });
    }
}
