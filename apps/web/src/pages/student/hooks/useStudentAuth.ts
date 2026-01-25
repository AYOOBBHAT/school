import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabase';
import { getProfile } from '../../../services/auth.service';

export function useStudentAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyRole = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) {
          navigate('/login');
          return;
        }

        const data = await getProfile(token);
        const role = data.profile?.role;

        if (role !== 'student') {
          const redirectMap: Record<string, string> = {
            principal: '/principal/dashboard',
            clerk: '/clerk',
            teacher: '/teacher/classes',
            parent: '/parent'
          };
          const redirectPath = redirectMap[role] || '/login';
          navigate(redirectPath, { replace: true });
          return;
        }
      } catch (error) {
        console.error('[StudentDashboard] Error verifying role:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    verifyRole();
  }, [navigate]);

  return { loading };
}
