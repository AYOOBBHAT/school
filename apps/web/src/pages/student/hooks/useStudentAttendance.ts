import { useState, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';
import { fetchStudentAttendance } from '../../../services/student.service';
import { AttendanceRecord, AttendanceSummary } from '../types';

export function useStudentAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.error('[StudentDashboard] No token available');
        return;
      }

      const data = await fetchStudentAttendance(token);
      console.log('[useStudentAttendance] Attendance loaded:', {
        records: data.attendance?.length || 0,
        summary: data.summary
      });
      setAttendance(data.attendance || []);
      setAttendanceSummary(data.summary || null);
    } catch (error) {
      console.error('[useStudentAttendance] Error loading attendance:', error);
      // Show user-friendly error message
      setAttendance([]);
      setAttendanceSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { attendance, attendanceSummary, loading, loadAttendance };
}
