import { api } from './api';
import { 
  Student, 
  ClassGroup, 
  Staff, 
  Exam, 
  ClassificationType,
  ClassificationValue,
  SalarySummary
} from '../types';

/**
 * Principal Service
 * Handles all principal-related API calls
 */

// Students
export async function loadStudents(): Promise<{ students: Student[] }> {
  return api.get<{ students: Student[] }>('/students');
}

export async function createStudent(data: {
  email: string;
  password: string;
  full_name: string;
  roll_number: string;
  class_group_id: string;
}): Promise<{ success: boolean; student: Student }> {
  return api.post<{ success: boolean; student: Student }>('/students-admin', data);
}

// Classes (load only; used by StudentsScreen filter and prefetch)
export async function loadClasses(): Promise<{ classes: ClassGroup[] }> {
  return api.get<{ classes: ClassGroup[] }>('/classes');
}

// Staff
export async function loadStaff(): Promise<{ staff: Staff[] }> {
  return api.get<{ staff: Staff[] }>('/staff-admin');
}

/** Create staff (teacher/clerk) - same endpoint and payload as web principal-users/staff */
export async function createStaff(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'teacher' | 'clerk';
  phone?: string | null;
  gender?: string | null;
  salary_start_date?: string | null;
}): Promise<{ message?: string; user?: { id: string; email: string; full_name: string; role: string } }> {
  const body: Record<string, unknown> = {
    email: data.email,
    password: data.password,
    full_name: data.full_name,
    role: data.role,
  };
  if (data.phone != null && data.phone !== '') body.phone = data.phone;
  if (data.gender != null && data.gender !== '') body.gender = data.gender;
  if (data.role === 'teacher' && data.salary_start_date) body.salary_start_date = data.salary_start_date;
  return api.post('/principal-users/staff', body);
}

// Exams
export async function loadExams(): Promise<{ exams: Exam[] }> {
  return api.get<{ exams: Exam[] }>('/exams');
}

// Classifications (same API as web: /classifications/*)
export async function loadClassificationTypes(): Promise<{ types: ClassificationType[] }> {
  return api.get<{ types: ClassificationType[] }>('/classifications/types');
}

export async function loadClassificationValues(typeId: string): Promise<{ values: ClassificationValue[] }> {
  return api.get<{ values: ClassificationValue[] }>(`/classifications/types/${typeId}/values`);
}

export async function createClassificationType(data: { name: string }): Promise<{ type: ClassificationType }> {
  return api.post<{ type: ClassificationType }>('/classifications/types', data);
}

export async function createClassificationValue(data: { classification_type_id: string; value: string }): Promise<{ value: ClassificationValue }> {
  return api.post<{ value: ClassificationValue }>('/classifications/values', data);
}

export async function deleteClassificationType(typeId: string): Promise<void> {
  await api.delete(`/classifications/types/${typeId}`);
}

export async function deleteClassificationValue(valueId: string): Promise<void> {
  await api.delete(`/classifications/values/${valueId}`);
}

// Salary
export async function loadSalarySummary(): Promise<{ summary: SalarySummary }> {
  return api.get<{ summary: SalarySummary }>('/salary/summary');
}

// Dashboard
export interface SchoolInfo {
  id: string;
  name: string;
  join_code?: string | null;
  registration_number?: string | null;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  logo_url?: string | null;
  created_at?: string | null;
}

export interface GenderBreakdown {
  male: number;
  female: number;
  other: number;
  unknown: number;
  total: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  studentsByGender: GenderBreakdown;
  staffByGender: GenderBreakdown;
  /** Principal: pending approvals count */
  pending_approvals?: number;
  /** Teacher/student: today's attendance, total classes */
  today_attendance?: number;
  total_classes?: number;
}

export async function loadSchoolInfo(): Promise<SchoolInfo> {
  const response = await api.get<{ school: SchoolInfo } | SchoolInfo>('/school/info');
  // Handle both { school: {...} } and direct school object (for backward compatibility)
  if (response && typeof response === 'object' && 'school' in response) {
    return (response as { school: SchoolInfo }).school;
  }
  return response as SchoolInfo;
}

export async function loadDashboardStats(): Promise<DashboardStats> {
  const response = await api.get<{ stats: DashboardStats }>('/dashboard/stats');
  return response.stats;
}

export async function loadDashboard(): Promise<DashboardStats> {
  return loadDashboardStats();
}
