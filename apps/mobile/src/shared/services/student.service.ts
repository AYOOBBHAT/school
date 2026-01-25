import { api } from './api';
import { Attendance, Mark, Fee } from '../types';

/**
 * Student Service
 * Handles all student-related API calls
 */

// Attendance
export async function loadAttendance(params?: {
  student_id?: string;
  class_group_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ attendance: Attendance[] }> {
  const query = new URLSearchParams();
  if (params?.student_id) query.append('student_id', params.student_id);
  if (params?.class_group_id) query.append('class_group_id', params.class_group_id);
  if (params?.start_date) query.append('start_date', params.start_date);
  if (params?.end_date) query.append('end_date', params.end_date);
  
  return api.get<{ attendance: Attendance[] }>(`/attendance?${query.toString()}`);
}

// Marks
export async function loadMarks(params?: {
  student_id?: string;
  subject_id?: string;
  exam_id?: string;
}): Promise<{ marks: Mark[] }> {
  const query = new URLSearchParams();
  if (params?.student_id) query.append('student_id', params.student_id);
  if (params?.subject_id) query.append('subject_id', params.subject_id);
  if (params?.exam_id) query.append('exam_id', params.exam_id);
  
  return api.get<{ marks: Mark[] }>(`/marks?${query.toString()}`);
}

// Fees
export async function loadFees(params?: {
  student_id?: string;
  status?: string;
}): Promise<{ fees: Fee[] }> {
  const query = new URLSearchParams();
  if (params?.student_id) query.append('student_id', params.student_id);
  if (params?.status) query.append('status', params.status);
  
  return api.get<{ fees: Fee[] }>(`/fees?${query.toString()}`);
}
