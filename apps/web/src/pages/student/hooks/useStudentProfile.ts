import { devError, devLog, devWarn } from '../../../utils/devLog';
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
    } catch (error: unknown) {
      devError('[useStudentProfile] Error loading profile:', error);
      if (error instanceof Error && error.name === 'StudentProfileNotFoundError') {
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
