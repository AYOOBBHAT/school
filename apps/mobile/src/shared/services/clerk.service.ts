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

// Fee Collection
export async function loadStudentMonthlyLedger(studentId: string): Promise<{ ledger: MonthlyLedgerEntry[] }> {
  return api.get<{ ledger: MonthlyLedgerEntry[] }>(`/students/${studentId}/monthly-ledger`);
}

export async function collectFeePayment(data: {
  monthly_fee_component_ids: string[];
  payment_amount: number;
  payment_date: string;
  payment_mode: 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer';
  transaction_id?: string;
  notes?: string;
}): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/clerk-fees/collect', data);
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
}): Promise<{ success: boolean; excess_amount?: number }> {
  return api.post<{ success: boolean; excess_amount?: number }>('/salary/payment', data);
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

// Fee Analytics
export async function loadUnpaidFeeAnalytics(params: {
  class_group_id?: string;
  time_scope?: string;
  page?: number;
  limit?: number;
}): Promise<{
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
}> {
  const query = new URLSearchParams();
  if (params.class_group_id) query.append('class_group_id', params.class_group_id);
  if (params.time_scope) query.append('time_scope', params.time_scope);
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());
  
  return api.get(`/clerk-fees/analytics/unpaid?${query.toString()}`);
}
