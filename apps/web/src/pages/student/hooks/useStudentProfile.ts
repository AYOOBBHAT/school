import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';
import { fetchStudentProfile } from '../../../services/student.service';
import { StudentProfile } from '../types';

export function useStudentProfile() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Load student profile (auth is already verified by useStudentAuth)
      const data = await fetchStudentProfile(token);
      setProfile(data.student);
    } catch (error: any) {
      console.error('[useStudentProfile] Error loading profile:', error);
      // Don't redirect on error - just show error state
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.error('[useStudentProfile] Student record not found');
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return { profile, loading, loadProfile };
}
