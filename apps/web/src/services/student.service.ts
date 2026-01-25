import { API_URL } from '../utils/api';
import { StudentProfile } from '../pages/student/types';

/**
 * Fetch student profile
 * @param token - Authentication token
 * @returns Student profile data
 */
export async function fetchStudentProfile(token: string): Promise<{ student: StudentProfile }> {
  const response = await fetch(`${API_URL}/students/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load profile' }));
    const errorMessage = errorData.error || 'Failed to load profile';
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Fetch student attendance records and summary
 * @param token - Authentication token
 * @returns Attendance data with records and summary
 */
export async function fetchStudentAttendance(token: string): Promise<{
  attendance: Array<{
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    created_at: string;
  }>;
  summary: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    attendancePercentage: number;
  };
}> {
  const response = await fetch(`${API_URL}/students/attendance`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to load attendance');
  }

  return await response.json();
}

/**
 * Fetch student marks
 * @param token - Authentication token
 * @returns Marks data
 */
export async function fetchStudentMarks(token: string): Promise<{
  marks: Array<{
    exam: {
      id: string;
      name: string;
      term: string;
      start_date: string;
      end_date: string;
    };
    subjects: Array<{
      subject: {
        id: string;
        name: string;
        code: string;
      };
      marks_obtained: number;
      max_marks: number;
      percentage: string;
    }>;
    overallPercentage: string;
  }>;
}> {
  const response = await fetch(`${API_URL}/students/marks`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load marks');
  }

  return await response.json();
}
