import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabase';
import { getProfile } from '../../../services/auth.service';

export function useTeacherAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const verifyRole = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        
        if (!token) {
          if (isMountedRef.current) {
            navigate('/login');
          }
          return;
        }

        const data = await getProfile(token);
        const resolvedRole = data.profile?.role;
          
          if (resolvedRole !== 'teacher') {
            console.warn('[useTeacherAuth] Unauthorized access attempt by role:', resolvedRole);
            const redirectMap: Record<string, string> = {
              principal: '/principal/dashboard',
              clerk: '/clerk',
              student: '/student/home',
              parent: '/parent/home'
            };
            const redirectPath = redirectMap[resolvedRole] || '/login';
            if (isMountedRef.current) {
              navigate(redirectPath, { replace: true });
            }
            return;
          }

        // Role is valid (teacher)
        if (isMountedRef.current) {
          setRole(resolvedRole);
          setProfile(data.profile);
        }
      } catch (error) {
        console.error('[useTeacherAuth] Error verifying role:', error);
        if (isMountedRef.current) {
          navigate('/login');
        }
        return;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    verifyRole();

    return () => {
      isMountedRef.current = false;
    };
  }, [navigate]);

  return { loading, role, profile };
}
