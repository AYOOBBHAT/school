import { api } from './api';
import { 
  Attendance, 
  Mark, 
  Assignment,
  Exam,
  StudentForAttendance,
  StudentForMarks
} from '../types';

/**
 * Teacher Service
 * Handles all teacher-related API calls
 */

/** Student list item for teacher fee status (students-admin returns students from teacher's assigned classes) */
export interface StudentForFeeStatus {
  id: string;
  roll_number?: string | null;
  status?: string;
  profile?: { id: string; full_name?: string; email?: string } | null;
  profiles?: { id: string; full_name?: string; email?: string } | null;
  class_groups?: { id: string; name?: string } | null;
}

export async function loadStudentsForFeeStatus(): Promise<{ students: StudentForFeeStatus[] }> {
  const res = await api.get<{ students: StudentForFeeStatus[] }>('/students-admin');
  return { students: res.students ?? [] };
}

// Assignments (same paths as web: /teacher-assignments/teacher/:teacherId and /teacher-attendance-assignments/teacher/:teacherId)
export async function loadTeacherAssignments(teacherId: string): Promise<{ assignments: Assignment[] }> {
  return api.get<{ assignments: Assignment[] }>(`/teacher-assignments/teacher/${teacherId}`);
}

export async function loadTeacherAttendanceAssignments(teacherId: string): Promise<{ assignments: Assignment[] }> {
  return api.get<{ assignments: Assignment[] }>(`/teacher-attendance-assignments/teacher/${teacherId}`);
}

// Attendance (same as web: students from students-admin by class + section, no date; existing records from GET /attendance)
export async function loadStudentsForAttendance(
  classGroupId: string,
  sectionId: string | undefined
): Promise<{ students: StudentForAttendance[] }> {
  if (!classGroupId) return { students: [] };
  const res = await api.get<{ classes?: Array<{ id: string; name?: string; students: any[]; sections?: Array<{ id: string; name?: string }> }> }>(
    `/students-admin?class_group_id=${encodeURIComponent(classGroupId)}${sectionId ? `&section_id=${encodeURIComponent(sectionId)}` : ''}`
  );
  const allStudents: StudentForAttendance[] = [];
  if (res.classes) {
    for (const cls of res.classes) {
      if (cls.id !== classGroupId) continue;
      const sectionsMap: Record<string, string> = {};
      if (cls.sections) {
        for (const sec of cls.sections) {
          sectionsMap[sec.id] = sec.name ?? '';
        }
      }
      for (const s of cls.students || []) {
        if (sectionId && s.section_id !== sectionId) continue;
        const fullName = s.profile?.full_name ?? '';
        allStudents.push({
          id: s.id,
          student_id: s.id,
          roll_number: s.roll_number ?? '',
          full_name: fullName,
          class_group_id: classGroupId,
          class_name: cls.name ?? '',
          section_id: s.section_id ?? null,
          section_name: s.section_id ? (sectionsMap[s.section_id] ?? null) : null,
          profile: s.profile ? { id: s.profile.id, full_name: s.profile.full_name, email: s.profile.email } : null,
        });
      }
      break;
    }
  }
  return { students: allStudents };
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

/**
 * Load students for marks entry by class (same as web: uses students-admin with class_group_id only).
 * Exam and subject are only used when submitting marks, not for fetching the list.
 */
export async function loadStudentsForMarks(class_group_id: string): Promise<{ students: StudentForMarks[] }> {
  if (!class_group_id) return { students: [] };
  const res = await api.get<{ classes?: Array<{ id: string; students: any[] }>; unassigned?: any[] }>(
    `/students-admin?class_group_id=${encodeURIComponent(class_group_id)}`
  );
  const allStudents: StudentForMarks[] = [];
  if (res.classes) {
    for (const cls of res.classes) {
      if (cls.id === class_group_id && cls.students) {
        for (const s of cls.students) {
          const fullName = s.profile?.full_name ?? '';
          allStudents.push({
            id: s.id,
            student_id: s.id,
            roll_number: s.roll_number ?? '',
            full_name: fullName,
            class_group_id: class_group_id,
            class_name: '',
            profile: s.profile ? { id: s.profile.id, full_name: s.profile.full_name, email: s.profile.email } : null,
          });
        }
        break;
      }
    }
  }
  return { students: allStudents };
}

export async function submitMarksBulk(marks: Mark[]): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/marks/bulk', { marks });
}

// Salary
export interface SalaryStructure {
  id: string;
  base_salary: number;
  hra: number;
  other_allowances: number;
  fixed_deductions: number;
  salary_cycle: string;
  attendance_based_deduction: boolean;
}

export interface SalaryRecord {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  total_deductions: number;
  attendance_deduction: number;
  net_salary: number;
  status: string;
  payment_date: string | null;
  payment_mode: string | null;
  rejection_reason: string | null;
}

export async function loadTeacherSalary(teacherId: string): Promise<{
  structure: SalaryStructure | null;
  records: SalaryRecord[];
}> {
  const [structureRes, recordsRes] = await Promise.all([
    api.get<{ structure: SalaryStructure }>(`/salary/structure/${teacherId}`).catch(() => ({ structure: null })),
    api.get<{ records: SalaryRecord[] }>('/salary/records')
  ]);

  return {
    structure: structureRes.structure || null,
    records: recordsRes.records || []
  };
}

/** Payment history item (matches backend teacher_payment_history) */
export interface PaymentHistoryItem {
  id: string;
  payment_date: string;
  amount: number;
  payment_type: string;
  payment_type_label?: string;
  payment_mode: string;
  payment_proof?: string | null;
  notes?: string | null;
  salary_month?: number | null;
  salary_year?: number | null;
  salary_period_label?: string | null;
  paid_by_name?: string | null;
  paid_by_email?: string | null;
  running_total?: number;
  created_at?: string;
}

export interface PaymentHistorySummary {
  total_paid?: number;
  total_payments?: number;
  average_payment?: number;
  pending_amount?: number;
  total_paid_till_date?: number;
  by_type?: Record<string, number>;
  by_mode?: Record<string, number>;
  date_range?: { first_payment_date: string | null; last_payment_date: string | null };
}

export interface PaymentHistoryResponse {
  payments: PaymentHistoryItem[];
  summary: PaymentHistorySummary | null;
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export async function loadSalaryPaymentHistory(
  teacherId: string,
  params: { page?: number; limit?: number; start_date?: string; end_date?: string; payment_type?: string; payment_mode?: string }
): Promise<PaymentHistoryResponse> {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.start_date) search.set('start_date', params.start_date);
  if (params.end_date) search.set('end_date', params.end_date);
  if (params.payment_type) search.set('payment_type', params.payment_type);
  if (params.payment_mode) search.set('payment_mode', params.payment_mode);
  const query = search.toString();
  const url = `/salary/history/${teacherId}${query ? `?${query}` : ''}`;
  const res = await api.get<{
    payments?: PaymentHistoryItem[];
    summary?: PaymentHistorySummary | null;
    pagination?: { page: number; limit: number; total: number; total_pages: number };
  }>(url);
  return {
    payments: res.payments || [],
    summary: res.summary ?? null,
    pagination: res.pagination ?? { page: 1, limit: 50, total: 0, total_pages: 0 },
  };
}
