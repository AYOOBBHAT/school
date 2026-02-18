import { api } from './api';
import { 
  Student, 
  ClassGroup,
  MonthlyLedgerEntry,
  Exam,
  MarksResult,
  UnpaidSalarySummary,
  UnpaidSalaryTeacher
} from '../types';

/**
 * Clerk Service
 * Handles all clerk-related API calls
 */

// Students & Classes
export async function loadStudents(): Promise<{ students: Student[] }> {
  return api.get<{ students: Student[] }>('/students');
}

export async function loadClasses(): Promise<{ classes: ClassGroup[] }> {
  return api.get<{ classes: ClassGroup[] }>('/classes');
}

// Fee Collection (same as web: students from students-admin, fee data from clerk-fees)
/** Student list item for fee collection UI (same shape as web FeeCollection) */
export interface StudentForFeeCollection {
  id: string;
  name: string;
  roll_number: string;
  class: string;
  class_group_id?: string;
}

/**
 * Load students for fee collection with optional class filter (same as web: GET students-admin).
 * Returns flat list parsed from data.classes (and unassigned when no class filter).
 */
export async function loadStudentsForFeeCollection(
  classGroupId?: string,
  page: number = 1,
  limit: number = 50
): Promise<{ students: StudentForFeeCollection[]; classes?: Array<{ id: string; name: string; students?: any[] }>; total_students?: number }> {
  const params = new URLSearchParams();
  if (classGroupId) params.append('class_group_id', classGroupId);
  params.append('page', String(page));
  params.append('limit', String(Math.min(limit, 100)));
  const res = await api.get<{ classes?: Array<{ id: string; name: string; students?: any[] }>; unassigned?: any[]; total_students?: number; pagination?: { total: number } }>(
    `/students-admin?${params.toString()}`
  );
  const list: StudentForFeeCollection[] = [];
  if (res.classes && Array.isArray(res.classes)) {
    for (const cls of res.classes) {
      const className = cls.name || 'N/A';
      for (const s of cls.students || []) {
        list.push({
          id: s.id,
          name: s.profile?.full_name || 'Unknown',
          roll_number: s.roll_number ?? 'N/A',
          class: className,
          class_group_id: cls.id,
        });
      }
    }
  }
  if (!classGroupId && res.unassigned && Array.isArray(res.unassigned)) {
    for (const s of res.unassigned) {
      list.push({
        id: s.id,
        name: s.profile?.full_name || 'Unknown',
        roll_number: s.roll_number ?? 'N/A',
        class: 'Unassigned',
        class_group_id: undefined,
      });
    }
  }
  const total = res.total_students ?? res.pagination?.total ?? list.length;
  return { students: list, classes: res.classes, total_students: total };
}

/**
 * Load student fee structure and monthly ledger (same as web: GET clerk-fees/student/:id/fee-structure).
 * Returns fee_structure + monthly_ledger, or message when no fee configured.
 */
export async function loadStudentFeeStructure(studentId: string): Promise<{
  fee_structure: any | null;
  monthly_ledger: MonthlyLedgerEntry[];
  message?: string;
  student?: { id: string; name: string; roll_number: string; class: string };
}> {
  const data = await api.get<{ fee_structure: any; monthly_ledger: any[]; message?: string; student?: any }>(
    `/clerk-fees/student/${studentId}/fee-structure`
  );
  if (data.message && data.fee_structure === null) {
    return { fee_structure: null, monthly_ledger: [], message: data.message, student: data.student };
  }
  return {
    fee_structure: data.fee_structure ?? null,
    monthly_ledger: data.monthly_ledger || [],
    message: data.message,
    student: data.student,
  };
}

/** Legacy: load monthly ledger only (use loadStudentFeeStructure for fee collection to get no-fee message). */
export async function loadStudentMonthlyLedger(studentId: string): Promise<{ ledger: MonthlyLedgerEntry[]; fee_structure?: any | null; message?: string }> {
  const data = await loadStudentFeeStructure(studentId);
  return { ledger: data.monthly_ledger, fee_structure: data.fee_structure, message: data.message };
}

export async function loadStudentPayments(studentId: string): Promise<{
  payments: Array<{
    id: string;
    payment_amount: number;
    payment_date: string;
    payment_mode: string;
    receipt_number?: string;
    transaction_id?: string;
    cheque_number?: string;
    bank_name?: string;
    monthly_fee_components?: { fee_name: string; fee_type: string; period_month?: number; period_year?: number };
    received_by_profile?: { full_name: string };
  }>;
  pagination: { page: number; limit: number; total: number; total_pages: number };
}> {
  return api.get<{ payments: any[]; pagination: any }>(`/clerk-fees/student/${studentId}/payments`);
}

export async function collectFeePayment(data: {
  monthly_fee_component_ids: string[];
  payment_amount: number;
  payment_date: string;
  payment_mode: 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer';
  transaction_id?: string;
  cheque_number?: string;
  bank_name?: string;
  notes?: string;
}): Promise<{ success: boolean; receipt_number?: string; payment?: any; message?: string }> {
  return api.post<{ success: boolean; receipt_number?: string; payment?: any; message?: string }>('/clerk-fees/collect', data);
}

// Salary Payment
export async function loadUnpaidSalaries(
  timeScope: string, 
  page?: number, 
  limit?: number
): Promise<{
  summary: UnpaidSalarySummary;
  teachers: UnpaidSalaryTeacher[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}> {
  const query = new URLSearchParams();
  query.append('time_scope', timeScope);
  if (page) query.append('page', page.toString());
  if (limit) query.append('limit', limit.toString());
  
  return api.get<{
    summary: UnpaidSalarySummary;
    teachers: UnpaidSalaryTeacher[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }>(`/salary/unpaid?${query.toString()}`);
}

/** Same as web: GET /salary/summary for total due/paid per teacher (optional for modal). */
export async function loadSalarySummary(): Promise<{
  summaries: Array<{
    teacher_id: string;
    teacher_name?: string;
    teacher?: { id: string; full_name?: string; email?: string };
    total_salary_due?: number;
    total_salary_paid?: number;
    total_unpaid?: number;
    unpaid_months?: number;
    pending_salary?: number;
  }>;
}> {
  return api.get<{ summaries: any[] }>('/salary/summary');
}

/** Same as web: GET /salary/history/:teacherId for payment history (View History). */
export async function loadSalaryPaymentHistory(
  teacherId: string,
  params?: { page?: number; limit?: number; start_date?: string; end_date?: string; payment_type?: string; payment_mode?: string }
): Promise<{
  payments: Array<{
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
    running_total?: number;
    created_at: string;
  }>;
  summary?: {
    total_paid: number;
    total_payments: number;
    average_payment: number;
    pending_amount: number;
    total_paid_till_date: number;
    by_type?: Record<string, number>;
    by_mode?: Record<string, number>;
    date_range?: { first_payment_date: string | null; last_payment_date: string | null };
  };
  pagination?: { page: number; limit: number; total: number; total_pages: number };
}> {
  const q = new URLSearchParams();
  if (params?.page) q.append('page', String(params.page));
  if (params?.limit) q.append('limit', String(params.limit));
  if (params?.start_date) q.append('start_date', params.start_date);
  if (params?.end_date) q.append('end_date', params.end_date);
  if (params?.payment_type) q.append('payment_type', params.payment_type);
  if (params?.payment_mode) q.append('payment_mode', params.payment_mode);
  return api.get<{ payments: any[]; summary?: any; pagination?: any }>(`/salary/history/${teacherId}?${q.toString()}`);
}

export async function recordSalaryPayment(data: {
  teacher_id: string;
  payment_date: string;
  amount: number;
  payment_mode: 'bank' | 'cash' | 'upi';
  payment_proof?: string;
  notes?: string;
  salary_month: number;
  salary_year: number;
  payment_type: 'salary' | 'advance' | 'adjustment' | 'bonus' | 'loan' | 'other';
}): Promise<{ success: boolean; excess_amount?: number; credit_applied?: { applied_amount?: number; months_applied?: number; remaining_credit?: number } }> {
  return api.post<{ success: boolean; excess_amount?: number; credit_applied?: any }>('/salary/payments', data);
}

// Marks & Results
export async function loadExams(): Promise<{ exams: Exam[] }> {
  return api.get<{ exams: Exam[] }>('/exams');
}

export async function loadMarksResults(params: {
  class_group_id?: string;
  exam_id?: string;
}): Promise<{ results: MarksResult[] }> {
  const query = new URLSearchParams();
  if (params.class_group_id) query.append('class_group_id', params.class_group_id);
  if (params.exam_id) query.append('exam_id', params.exam_id);
  
  return api.get<{ results: MarksResult[] }>(`/marks/results?${query.toString()}`);
}

// Dashboard Stats
export interface DashboardStats {
  total_students: number;
  today_collection: number;
  total_pending: number;
  recentPayments?: Array<{
    payment_amount: number;
    payment_date: string;
    payment_mode: string;
  }>;
}

// For backward compatibility with web app format
export interface DashboardStatsWebFormat {
  totalStudents: number;
  todayCollection: number;
  totalPending: number;
  recentPayments: Array<{
    payment_amount: number;
    payment_date: string;
    payment_mode: string;
  }>;
}

export async function loadRecentPayments(limit: number = 10): Promise<Array<{
  payment_amount: number;
  payment_date: string;
  payment_mode: string;
}>> {
  try {
    // Get recent payments from monthly_fee_payments
    // Note: This might need to be implemented in backend or use a different approach
    // For now, return empty array - can be enhanced later
    return [];
  } catch (error) {
    console.warn('[Clerk Service] Could not load recent payments:', error);
    return [];
  }
}

export async function loadDashboardStats(): Promise<DashboardStatsWebFormat> {
  // Get stats from dashboard endpoint (role-specific for clerk)
  const stats = await api.get<DashboardStats>('/dashboard');
  
  // Get recent payments (last 10) - for now return empty, can be enhanced
  const recentPayments = await loadRecentPayments(10);
  
  // Convert to web format for consistency
  return {
    totalStudents: stats.total_students || 0,
    todayCollection: stats.today_collection || 0,
    totalPending: stats.total_pending || 0,
    recentPayments: recentPayments,
  };
}

// Fee Analytics
export interface UnpaidFeeAnalytics {
  summary: {
    total_students: number;
    unpaid_count: number;
    partially_paid_count: number;
    paid_count: number;
    total_unpaid_amount: number;
  };
  chart_data: {
    paid: number;
    unpaid: number;
    partially_paid: number;
  };
  students: Array<{
    student_id: string;
    student_name: string;
    roll_number: string;
    class_name: string;
    parent_name: string;
    parent_phone: string;
    parent_address: string;
    pending_months: number | string;
    total_pending: number;
    total_fee: number;
    total_paid: number;
    payment_status: 'paid' | 'unpaid' | 'partially-paid';
    fee_component_breakdown?: Array<{
      fee_type: string;
      fee_name: string;
      total_months_due: number;
      paid_months: number;
      pending_months: number;
      total_fee_amount: number;
      total_paid_amount: number;
      total_pending_amount: number;
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export async function loadUnpaidFeeAnalytics(params: {
  class_group_id?: string;
  time_scope?: string;
  page?: number;
  limit?: number;
}): Promise<UnpaidFeeAnalytics> {
  const query = new URLSearchParams();
  if (params.class_group_id) query.append('class_group_id', params.class_group_id);
  if (params.time_scope) query.append('time_scope', params.time_scope);
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());
  
  return api.get<UnpaidFeeAnalytics>(`/clerk-fees/analytics/unpaid?${query.toString()}`);
}
