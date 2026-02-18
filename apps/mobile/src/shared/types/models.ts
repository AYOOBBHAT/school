/**
 * Core Domain Models
 * Single source of truth for all domain types
 * Matches backend schema (snake_case where applicable)
 */

export type UserRole = 'principal' | 'clerk' | 'teacher' | 'student' | 'parent';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role?: UserRole | null;
  created_at: string;
  updated_at?: string | null;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  schoolId: string;
  schoolName?: string | null;
}

export interface Student {
  id: string;
  roll_number: string;
  status: string;
  class_group_id: string;
  profile_id: string;
  section_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  class_groups?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  sections?: {
    id: string;
    name: string;
    class_group_id: string;
  } | null;
}

export interface Teacher {
  id: string;
  profile_id: string;
  subject_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  subjects?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface Staff {
  id: string;
  profile_id?: string;
  role: 'teacher' | 'clerk';
  subject_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Present when API returns flat profile (e.g. staff-admin) */
  full_name?: string | null;
  email?: string | null;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  subjects?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface ClassGroup {
  id: string;
  name: string;
  description?: string | null;
  school_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Section {
  id: string;
  name: string;
  class_group_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  school_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Assignment {
  id: string;
  teacher_id: string;
  class_group_id: string;
  subject_id: string;
  section_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  teachers?: {
    id: string;
    profile_id: string;
  } | null;
  class_groups?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  subjects?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  sections?: {
    id: string;
    name: string;
  } | null;
}

export interface Exam {
  id: string;
  name: string;
  term: string;
  start_date: string;
  end_date: string;
  school_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AttendanceRecord {
  id?: string | null;
  student_id: string;
  class_group_id: string;
  section_id?: string | null;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MarkRecord {
  id?: string | null;
  student_id: string;
  subject_id: string;
  exam_id: string;
  class_group_id?: string | null;
  marks_obtained: number;
  max_marks: number;
  remarks?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FeeStructure {
  id: string;
  student_id: string;
  component_name: string;
  amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Payment {
  id: string;
  student_id?: string | null;
  monthly_fee_component_ids: string[];
  payment_amount: number;
  payment_date: string;
  payment_mode: 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer';
  transaction_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SalaryRecord {
  id: string;
  teacher_id: string;
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  period_label: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  gross_salary?: number | null;
  net_salary: number;
  paid_amount: number;
  credit_applied: number;
  effective_paid_amount: number;
  pending_amount: number;
  payment_status: string;
  status?: 'paid' | 'pending' | 'approved' | 'rejected' | null;
  payment_date?: string | null;
  days_since_period_start: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DashboardStats {
  total_students?: number | null;
  total_teachers?: number | null;
  total_classes?: number | null;
  pending_approvals?: number | null;
  today_attendance?: number | null;
  recent_payments?: number | null;
}

export interface Classification {
  id: string;
  type: string;
  value: string;
  school_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class_group_id: string;
  subject_id: string;
  section_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// Fee-related types
export interface Fee {
  id: string;
  student_id: string;
  bill_number: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  created_at?: string | null;
  updated_at?: string | null;
}

// Legacy aliases for backward compatibility
export type Attendance = AttendanceRecord;
export type Mark = MarkRecord;

// Additional service-specific types
export interface MonthlyLedgerEntry {
  id: string;
  student_id: string;
  component_name: string;
  amount: number;
  period_start: string;
  period_end: string;
  due_date: string;
  payment_status: string;
  paid_amount: number;
  pending_amount: number;
  components?: Array<{
    id: string;
    component_name: string;
    amount: number;
    paid_amount: number;
    pending_amount: number;
  }> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UnpaidSalarySummary {
  total_teachers: number;
  total_unpaid_amount: number;
  total_unpaid_months: number;
  time_scope: string;
  start_date: string;
  end_date: string;
}

export interface UnpaidSalaryTeacher {
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  unpaid_months_count: number;
  total_unpaid_amount: number;
  max_days_unpaid: number;
  oldest_unpaid_month: {
    month: number;
    year: number;
    period_label: string;
    period_start: string;
    days_since_period_start: number;
  } | null;
  latest_unpaid_month: {
    month: number;
    year: number;
    period_label: string;
    period_start: string;
    days_since_period_start: number;
  } | null;
  unpaid_months: Array<{
    month: number;
    year: number;
    period_start: string;
    period_label: string;
    payment_status: string;
    net_salary: number;
    paid_amount: number;
    credit_applied: number;
    effective_paid_amount: number;
    pending_amount: number;
    days_since_period_start: number;
    payment_date: string | null;
  }>;
}

export interface MarksResult {
  id?: string | null;
  student_id: string;
  student_name?: string | null;
  roll_number: string;
  subject_id: string;
  subject_name?: string | null;
  exam_id: string;
  exam_name?: string | null;
  marks_obtained: number;
  max_marks: number;
  percentage?: number | null;
  grade?: string | null;
  class_group_id: string;
  class_name?: string | null;
  students?: {
    id: string;
    profiles?: {
      full_name: string;
    } | null;
    class_groups?: {
      name: string;
    } | null;
  } | null;
  subjects?: {
    id: string;
    name: string;
  } | null;
  exams?: {
    id: string;
    name: string;
  } | null;
}

export interface StudentForAttendance {
  id: string;
  student_id: string;
  roll_number: string;
  full_name: string;
  class_group_id: string;
  class_name: string;
  section_id?: string | null;
  section_name?: string | null;
  attendance_status?: 'present' | 'absent' | 'late' | 'excused' | null;
  remarks?: string | null;
  profile?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface StudentForMarks {
  id: string;
  student_id: string;
  roll_number: string;
  full_name: string;
  class_group_id: string;
  class_name: string;
  existing_marks?: {
    marks_obtained: number;
    max_marks: number;
    remarks?: string | null;
  } | null;
  profile?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface SalarySummary {
  total_teachers: number;
  total_paid: number;
  total_pending: number;
  summaries?: Array<{
    month: number;
    year: number;
    paid: number;
    pending: number;
  }> | null;
  monthly_breakdown?: Array<{
    month: number;
    year: number;
    paid: number;
    pending: number;
  }> | null;
}

export interface ClassificationType {
  id: string;
  name: string;
  school_id: string;
  display_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ClassificationValue {
  id: string;
  value: string;
  classification_type_id: string;
  display_order?: number | null;
  created_at?: string | null;
}
