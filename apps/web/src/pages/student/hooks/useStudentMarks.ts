import { useState, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';
import { fetchStudentMarks } from '../../../services/student.service';
import { Mark } from '../types';

export function useStudentMarks() {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMarks = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await fetchStudentMarks(token);
      setMarks(data.marks || []);
    } catch (error) {
      console.error('Error loading marks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { marks, loading, loadMarks };
}
