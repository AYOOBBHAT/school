import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

type Role = 'principal' | 'clerk' | 'teacher' | 'student' | 'parent' | 'admin';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; schoolId: string | null };
      supabase?: any;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const supabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
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
        role: 'admin' as Role,
        schoolId: null
      };
      return next();
    }

    // Get user profile to get role and school_id
    // Use service role key to bypass RLS for profile lookup
    if (!supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, role, school_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[authMiddleware] Error fetching profile:', profileError);
      return res.status(403).json({ error: 'Profile not found' });
    }

    if (!profile) {
      console.error('[authMiddleware] Profile not found for user:', user.id);
      return res.status(403).json({ error: 'Profile not found' });
    }

    if (!profile.role) {
      console.error('[authMiddleware] Profile missing role:', profile);
      return res.status(403).json({ error: 'Invalid profile data' });
    }

    // Log school_id for debugging
    if (!profile.school_id) {
      console.warn('[authMiddleware] Profile has no school_id:', { userId: user.id, role: profile.role });
    } else {
      console.log('[authMiddleware] User authenticated:', { userId: user.id, role: profile.role, schoolId: profile.school_id });
    }

    req.user = {
      id: user.id,
      role: profile.role as Role,
      schoolId: profile.school_id
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

export function requireRoles(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

// Middleware to check if school has paid subscription
export async function checkPaymentStatus(req: Request, res: Response, next: NextFunction) {
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
    const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
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
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check payment status' });
  }
}


