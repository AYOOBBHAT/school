import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

type Role = 'principal' | 'clerk' | 'teacher' | 'student' | 'parent';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; schoolId: string };
      supabase?: any;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;

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

    // Get user profile to get role and school_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    if (!profile.role || !profile.school_id) {
      return res.status(403).json({ error: 'Invalid profile data' });
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


