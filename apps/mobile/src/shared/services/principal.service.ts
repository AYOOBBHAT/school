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
 * Handles all principal-related API calls.
 * Students flow matches web: GET /students-admin (classes + unassigned), POST /principal-users/students (create).
 */

// --- Students Admin (same API as web principal/students) ---

export interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  created_at?: string;
}

export interface StudentInClass {
  id: string;
  roll_number: string | null;
  status?: string;
  section_id?: string | null;
  section_name?: string | null;
  admission_date?: string | null;
  class_group_id?: string | null;
  profile?: StudentProfile | null;
}

export interface ClassWithStudents {
  id: string;
  name: string;
  description?: string | null;
  classifications?: Array<{ type: string; value: string; type_id?: string; value_id?: string }>;
  students: StudentInClass[];
  student_count: number;
}

export interface StudentsAdminResponse {
  classes: ClassWithStudents[];
  unassigned: StudentInClass[];
  total_students: number;
  pagination?: { page: number; limit: number; total: number; total_pages: number };
}

/** Load students grouped by class + unassigned (same as web loadStudentsAdmin) */
export async function loadStudentsAdmin(): Promise<StudentsAdminResponse> {
  return api.get<StudentsAdminResponse>('/students-admin');
}

/** Load sections for a class (same as web loadClassSections) */
export async function loadClassSections(classId: string): Promise<{ sections: Array<{ id: string; name: string; class_id?: string }> }> {
  return api.get<{ sections: Array<{ id: string; name: string; class_id?: string }> }>(`/classes/${classId}/sections`);
}

/** Default fees for a class (for add/edit student fee config) */
export interface DefaultFeesResponse {
  class_fees: Array<{ id: string; amount?: number; fee_cycle?: string; fee_categories?: { name?: string } }>;
  transport_routes: Array<{ id: string; route_name?: string; bus_number?: string; fee?: { total?: number; fee_cycle?: string } }>;
  other_fee_categories?: unknown[];
  optional_fees?: unknown[];
  custom_fees?: Array<{ id: string; amount?: number; fee_cycle?: string; name?: string; fee_categories?: { name?: string }; class_groups?: { name?: string } }>;
}

export async function loadDefaultFees(classId: string): Promise<DefaultFeesResponse> {
  return api.get<DefaultFeesResponse>(`/principal-users/classes/${classId}/default-fees`);
}

export interface StudentFeeConfigResponse {
  fee_config: {
    id: string;
    student_id: string;
    class_fee_id?: string;
    class_fee_discount?: number;
    transport_enabled?: boolean;
    transport_route_id?: string | null;
    transport_fee_discount?: number;
    other_fees?: unknown;
    custom_fees?: Array<{ custom_fee_id: string; discount: number; is_exempt: boolean }>;
    effective_from_date?: string | null;
  } | null;
}

export async function loadStudentFeeConfig(studentId: string): Promise<StudentFeeConfigResponse> {
  return api.get<StudentFeeConfigResponse>(`/students-admin/${studentId}/fee-config`);
}

export async function updateStudent(studentId: string, data: {
  class_group_id?: string | null;
  section_id?: string | null;
  roll_number?: string | null;
  fee_config?: {
    class_fee_id?: string;
    class_fee_discount?: number;
    transport_enabled?: boolean;
    transport_route_id?: string | null;
    transport_fee_discount?: number;
    other_fees?: unknown[];
    custom_fees?: Array<{ custom_fee_id: string; discount: number; is_exempt: boolean }>;
    effective_from_date?: string;
  };
}): Promise<{ message?: string }> {
  return api.put<{ message?: string }>(`/students-admin/${studentId}`, data);
}

export async function promoteStudent(studentId: string, data: { target_class_id: string }): Promise<{ message?: string }> {
  return api.post<{ message?: string }>(`/students-admin/${studentId}/promote`, data);
}

export async function promoteClass(classId: string, data: { target_class_id: string; clear_sections?: boolean }): Promise<{ message?: string }> {
  return api.post<{ message?: string }>(`/students-admin/class/${classId}/promote`, data);
}

export interface UsernameCheckResponse {
  available: boolean;
  message?: string;
}

export async function checkUsername(username: string): Promise<UsernameCheckResponse> {
  return api.get<UsernameCheckResponse>(`/principal-users/check-username/${encodeURIComponent(username)}`);
}

/** Create student (same as web: POST /principal-users/students, full payload) */
export interface CreateStudentPayload {
  email: string;
  password: string;
  full_name: string;
  username: string;
  phone?: string | null;
  roll_number?: string | null;
  class_group_id?: string | null;
  section_id?: string | null;
  admission_date?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  home_address?: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email?: string | null;
  guardian_relationship?: string;
  fee_config?: {
    class_fee_id?: string;
    class_fee_discount?: number;
    transport_enabled?: boolean;
    transport_route_id?: string | null;
    transport_fee_discount?: number;
    other_fees?: unknown[];
    custom_fees?: Array<{ custom_fee_id: string; discount: number; is_exempt: boolean }>;
  };
}

export async function createStudent(data: CreateStudentPayload): Promise<{ id?: string; message?: string }> {
  return api.post<{ id?: string; message?: string }>('/principal-users/students', data);
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
