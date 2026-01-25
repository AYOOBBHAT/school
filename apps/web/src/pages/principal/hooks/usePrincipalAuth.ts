import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabase';
import { getProfile } from '../../../services/auth.service';

export function usePrincipalAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const verifyRole = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const user = session.data.session?.user;
        
        console.log('[usePrincipalAuth] Session check:', {
          hasToken: !!token,
          hasUser: !!user,
          userId: user?.id,
          email: user?.email
        });
        
        if (!token || !user) {
          console.warn('[usePrincipalAuth] No session or token found, redirecting to login');
          if (isMountedRef.current) {
            navigate('/login');
          }
          return;
        }

        // Check user role via backend
        let data;
        try {
          data = await getProfile(token);
        } catch (parseError) {
            console.error('[usePrincipalAuth] Error parsing profile response:', parseError);
            // Fallback: try to get profile directly from Supabase
            const userId = session.data.session?.user?.id;
            if (!userId) {
              if (isMountedRef.current) {
                navigate('/login');
              }
              return;
            }
            
            const { data: profileData } = await supabase
              .from('profiles')
              .select('role, approval_status')
              .eq('id', userId)
              .single();
            
            if (profileData && (profileData as any).role === 'principal') {
              // Profile found, allow access
              if (isMountedRef.current) {
                setRole('principal');
              }
              return;
            } else {
              if (isMountedRef.current) {
                navigate('/login');
              }
              return;
            }
          }
          
          const resolvedRole = data?.profile?.role;
          
          // Only principals and clerks can access this dashboard
          if (resolvedRole !== 'principal' && resolvedRole !== 'clerk') {
            console.warn('[usePrincipalAuth] Unauthorized access attempt by role:', resolvedRole);
            // Redirect to appropriate dashboard based on role
            const redirectMap: Record<string, string> = {
              student: '/student/home',
              teacher: '/teacher/classes',
              parent: '/parent/home'
            };
            const redirectPath = redirectMap[resolvedRole] || '/login';
            if (isMountedRef.current) {
              navigate(redirectPath, { replace: true });
            }
            return;
          }

          // Role is valid (principal or clerk)
          if (isMountedRef.current) {
            setRole(resolvedRole);
          }
      } catch (error) {
        console.error('[usePrincipalAuth] Error verifying role:', error);
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

  return { loading, role };
}
