import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabase';
import { getProfile } from '../../../services/auth.service';

export function useClerkAuth() {
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

        if (resolvedRole !== 'clerk' && resolvedRole !== 'principal') {
          const redirectMap: Record<string, string> = {
            teacher: '/teacher/classes',
            student: '/student/home',
            parent: '/parent'
          };
          const redirectPath = redirectMap[resolvedRole] || '/login';
          if (isMountedRef.current) {
            navigate(redirectPath, { replace: true });
          }
          return;
        }

        // Role is valid (clerk or principal)
        if (isMountedRef.current) {
          setRole(resolvedRole);
          setProfile(data.profile);
        }
      } catch (error) {
        console.error('[useClerkAuth] Error verifying role:', error);
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
