import { API_URL } from '../utils/api';

/**
 * Load attendance assignments for a teacher
 * @param token - Authentication token
 * @param userId - Teacher user ID
 * @returns Array of assignments
 */
export async function loadAttendanceAssignments(token: string, userId: string): Promise<Array<{
  id: string;
  class_group_id: string;
  section_id: string | null;
  subject_id: string;
  class_groups: { id: string; name: string; description: string | null };
  sections: { id: string; name: string } | null;
  subjects: { id: string; name: string; code: string | null };
}>> {
  const response = await fetch(`${API_URL}/teacher-attendance-assignments/teacher/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  // Convert attendance assignments to assignment format for compatibility
  return (data.assignments || []).map((aa: any) => ({
    id: aa.id,
    class_group_id: aa.class_group_id,
    section_id: aa.section_id,
    subject_id: '', // Not applicable for attendance
    class_groups: aa.class_group || { id: '', name: 'N/A', description: null },
    sections: aa.section || null,
    subjects: { id: '', name: 'Attendance', code: null } // Dummy subject for display
  }));
}

/**
 * Load attendance records for a specific date and class
 * @param token - Authentication token
 * @param classGroupId - Class group ID
 * @param date - Date string (YYYY-MM-DD)
 * @returns Record of student IDs to attendance status
 */
export async function loadAttendanceForDate(
  token: string,
  classGroupId: string,
  date: string
): Promise<Record<string, 'present' | 'absent' | 'late'>> {
  const response = await fetch(`${API_URL}/attendance?class_group_id=${classGroupId}&date=${date}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return {};
  }

  const data = await response.json();
  const records: Record<string, 'present' | 'absent' | 'late'> = {};
  if (data.attendance) {
    data.attendance.forEach((a: any) => {
      records[a.student_id] = a.status || 'present';
    });
  }
  return records;
}

/**
 * Save attendance records in bulk
 * @param token - Authentication token
 * @param attendanceData - Array of attendance records
 */
export async function saveAttendance(
  token: string,
  attendanceData: Array<{
    student_id: string;
    class_group_id: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    school_id: string;
  }>
): Promise<void> {
  const response = await fetch(`${API_URL}/attendance/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ attendance: attendanceData }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save attendance');
  }
}
