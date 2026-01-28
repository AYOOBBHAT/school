import { API_URL } from '../utils/api';
import { supabase } from '../utils/supabase';
import { 
  StudentResponse, 
  StudentsAdminResponse, 
  ClassResponse, 
  DashboardStatsResponse,
  FeeStructureResponse,
  CollectFeeResponse,
  PaymentHistoryResponse,
  UnpaidFeeAnalyticsResponse,
  RecordSalaryPaymentResponse
} from './types';

/**
 * Load students list
 * @param token - Authentication token
 * @returns Students data
 */
export async function loadStudents(token: string): Promise<StudentResponse> {
  const response = await fetch(`${API_URL}/clerk/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return { students: [] };
  }

  return await response.json();
}

/**
 * Load students for fee collection (with optional class filter)
 * @param token - Authentication token
 * @param classGroupId - Optional class group ID to filter by
 * @returns Students data with classes structure
 */
export async function loadStudentsForFeeCollection(token: string, classGroupId?: string): Promise<StudentsAdminResponse> {
  let url = `${API_URL}/clerk/students-admin`;
  if (classGroupId) {
    url += `?class_group_id=${classGroupId}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return { classes: [], unassigned: [] };
  }

  return await response.json();
}

/**
 * Load classes for fee collection
 * @param token - Authentication token
 * @returns Classes data
 */
export async function loadClassesForFeeCollection(token: string): Promise<ClassResponse> {
  const response = await fetch(`${API_URL}/clerk/classes`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return { classes: [] };
  }

  return await response.json();
}

/**
 * Load student fee structure
 * @param token - Authentication token
 * @param studentId - Student ID
 * @returns Fee structure data
 */
export async function loadStudentFeeStructure(token: string, studentId: string): Promise<FeeStructureResponse> {
  const response = await fetch(`${API_URL}/clerk-fees/student/${studentId}/fee-structure`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error && errorData.error.includes('No fee configured')) {
      return { message: 'No fee configured for this student', fee_structure: null, monthly_ledger: [] };
    }
    throw new Error(errorData.error || 'Failed to load fee structure');
  }

  return await response.json();
}

/**
 * Load student payments
 * @param token - Authentication token
 * @param studentId - Student ID
 * @returns Payments data
 */
export async function loadStudentPayments(token: string, studentId: string): Promise<{
  payments: Array<{
    id: string;
    amount_paid: number;
    payment_date: string;
    payment_mode: string;
    transaction_id: string;
  }>;
}> {
  const response = await fetch(`${API_URL}/clerk-fees/student/${studentId}/payments`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return { payments: [] };
  }

  return await response.json();
}

/**
 * Collect fee payment
 * @param token - Authentication token
 * @param paymentData - Payment data
 * @returns Payment result
 */
export async function collectFee(token: string, paymentData: any): Promise<CollectFeeResponse> {
  const response = await fetch(`${API_URL}/clerk-fees/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(paymentData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to collect fee');
  }

  return await response.json();
}

/**
 * Load unpaid fee analytics
 * @param token - Authentication token
 * @param params - Query parameters
 * @returns Analytics data
 */
export async function loadUnpaidFeeAnalytics(token: string, params: URLSearchParams): Promise<UnpaidFeeAnalyticsResponse> {
  const response = await fetch(`${API_URL}/clerk-fees/analytics/unpaid?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return {
      summary: {
        total_students: 0,
        unpaid_count: 0,
        partially_paid_count: 0,
        paid_count: 0,
        total_unpaid_amount: 0
      },
      chart_data: { paid: 0, unpaid: 0, partially_paid: 0 },
      students: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1
      }
    };
  }

  const data = await response.json();
  const result = data.analytics || data;
  // Ensure pagination exists
  if (!result.pagination) {
    result.pagination = {
      page: 1,
      limit: result.students?.length || 10,
      total: result.students?.length || 0,
      total_pages: 1
    };
  }
  return result;
}

/**
 * Load salary payment history
 * @param token - Authentication token
 * @param teacherId - Teacher ID
 * @param params - Query parameters
 * @returns Payment history data
 */
export async function loadSalaryPaymentHistory(token: string, teacherId: string, params: URLSearchParams): Promise<PaymentHistoryResponse> {
  const response = await fetch(`${API_URL}/salary/history/${teacherId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load payment history');
  }

  return await response.json();
}

/**
 * Load dashboard statistics for clerk
 * @param token - Authentication token (not used for Supabase queries, but kept for consistency)
 * @returns Dashboard statistics
 */
export async function loadDashboardStats(token: string): Promise<{
  totalStudents: number;
  todayCollection: number;
  totalPending: number;
  recentPayments: Array<{ payment_amount: number; payment_date: string; payment_mode: string }>;
}> {
  let recentPayments: any[] = [];
  let todayPayments: any[] = [];
  let pendingComponents: any[] = [];

  try {
    const { data, error } = await supabase
      .from('monthly_fee_payments')
      .select('payment_amount, payment_date, payment_mode')
      .order('payment_date', { ascending: false })
      .limit(10);
    if (!error && data) recentPayments = data;
  } catch (err) {
    console.error('Error loading recent payments from Supabase:', err);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('monthly_fee_payments')
      .select('payment_amount')
      .gte('payment_date', today);
    if (!error && data) todayPayments = data;
  } catch (err) {
    console.error('Error loading today payments from Supabase:', err);
  }

  try {
    const { data, error } = await supabase
      .from('monthly_fee_components')
      .select('pending_amount')
      .in('status', ['pending', 'partially-paid', 'overdue'])
      .gt('pending_amount', 0);
    if (!error && data) pendingComponents = data;
  } catch (err) {
    console.error('Error loading pending components from Supabase:', err);
  }

  const todayTotal = todayPayments.reduce((sum: number, p: any) => 
    sum + parseFloat(p.payment_amount || 0), 0);
  const totalPending = pendingComponents.reduce((sum: number, c: any) => 
    sum + parseFloat(c.pending_amount || 0), 0);

  // Get students count
  const studentsData = await loadStudents(token).catch(() => ({ students: [] }));

  return {
    totalStudents: studentsData.students?.length || 0,
    todayCollection: todayTotal,
    totalPending,
    recentPayments: recentPayments
  };
}

/**
 * Load unpaid salaries for teachers
 * @param token - Authentication token
 * @param timeScope - Time scope for unpaid salaries
 * @returns Unpaid salaries data
 */
export async function loadUnpaidSalaries(token: string, timeScope: string = 'last_12_months'): Promise<{
  teachers: Array<{
    id: string;
    name: string;
    unpaid_amount: number;
    unpaid_months: Array<{ month: number; year: number; amount: number }>;
  }>;
}> {
  const response = await fetch(`${API_URL}/salary/unpaid?time_scope=${timeScope}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    return { teachers: [] };
  }

  return await response.json();
}

/**
 * Load salary summary
 * @param token - Authentication token
 * @returns Salary summary data
 */
export async function loadSalarySummary(token: string): Promise<{
  summaries: Array<{
    teacher_id: string;
    teacher_name: string;
    total_unpaid: number;
    unpaid_months: number;
  }>;
}> {
  const response = await fetch(`${API_URL}/salary/summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load salary summaries' }));
    throw new Error(errorData.error || 'Failed to load salary summaries');
  }

  return await response.json();
}

/**
 * Record salary payment
 * @param token - Authentication token
 * @param paymentData - Payment data
 * @returns Payment result
 */
export async function recordSalaryPayment(token: string, paymentData: any): Promise<RecordSalaryPaymentResponse> {
  const response = await fetch(`${API_URL}/salary/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(paymentData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to record payment');
  }

  return await response.json();
}
