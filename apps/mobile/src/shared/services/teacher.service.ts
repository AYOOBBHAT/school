import { api } from './api';
import { 
  Attendance, 
  Mark, 
  Assignment,
  Exam,
  StudentForAttendance,
  StudentForMarks,
  SalaryRecord
} from '../types';

/**
 * Teacher Service
 * Handles all teacher-related API calls
 */

// Assignments
export async function loadTeacherAssignments(teacherId: string): Promise<{ assignments: Assignment[] }> {
  return api.get<{ assignments: Assignment[] }>(`/teacher-assignments?teacher_id=${teacherId}`);
}

export async function loadTeacherAttendanceAssignments(teacherId: string): Promise<{ assignments: Assignment[] }> {
  return api.get<{ assignments: Assignment[] }>(`/teacher-attendance-assignments?teacher_id=${teacherId}`);
}

// Attendance
export async function loadStudentsForAttendance(
  classGroupId: string,
  sectionId: string | undefined,
  date: string
): Promise<{ students: StudentForAttendance[]; isHoliday?: boolean; message?: string }> {
  const query = new URLSearchParams();
  query.append('class_group_id', classGroupId);
  if (sectionId) query.append('section_id', sectionId);
  query.append('date', date);
  
  return api.get<{ students: StudentForAttendance[]; isHoliday?: boolean; message?: string }>(`/attendance/students?${query.toString()}`);
}

export async function loadAttendanceForClass(
  classGroupId: string,
  date: string
): Promise<{ attendance: Attendance[] }> {
  const query = new URLSearchParams();
  query.append('class_group_id', classGroupId);
  query.append('date', date);
  
  return api.get<{ attendance: Attendance[] }>(`/attendance?${query.toString()}`);
}

export async function submitAttendanceBulk(attendance: Attendance[]): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/attendance/bulk', { attendance });
}

// Marks
export async function loadExams(): Promise<{ exams: Exam[] }> {
  return api.get<{ exams: Exam[] }>('/exams');
}

export async function loadStudentsForMarks(params: {
  class_group_id: string;
  exam_id: string;
  subject_id: string;
}): Promise<{ students: StudentForMarks[] }> {
  const query = new URLSearchParams();
  query.append('class_group_id', params.class_group_id);
  query.append('exam_id', params.exam_id);
  query.append('subject_id', params.subject_id);
  
  return api.get<{ students: StudentForMarks[] }>(`/marks/students?${query.toString()}`);
}

export async function submitMarksBulk(marks: Mark[]): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/marks/bulk', { marks });
}

// Salary
export async function loadTeacherSalary(): Promise<{ records: SalaryRecord[] }> {
  return api.get<{ records: SalaryRecord[] }>('/salary/teacher');
}
