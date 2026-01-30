/**
 * Shared types for service layer API responses
 */

// Core entity types (matching Supabase/DB nullable fields)
export type Subject = {
  id: string;
  name: string;
  code?: string | null;
  created_at: string;
};

export type ClassGroup = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  classifications?: Array<{
    type: string;
    value: string;
    type_id: string;
    value_id: string;
  }>;
  subjects?: Array<{
    id: string;
    name: string;
    code?: string;
    class_subject_id: string;
  }>;
};

export type Student = {
  id: string;
  full_name: string;
  section_name?: string | null;
  roll_number?: string | null;
};

export type MonthlyLedgerEntry = {
  month?: number;
  year?: number;
  amount?: number;
  paid?: number;
  monthNumber?: number;
  components?: any[];
};

// Profile types
export interface ProfileResponse {
  profile: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    gender?: string;
    role: string;
    approval_status: string;
    school_id: string;
    created_at: string;
  };
}

// Staff types
export interface StaffResponse {
  staff: Array<{
    id: string;
    profile_id: string;
    profile: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
      gender?: string;
      role: string;
      approval_status: string;
    };
    created_at: string;
  }>;
}

// Class types
export interface ClassResponse {
  classes: ClassGroup[];
  students?: Array<any>;
  total_students?: number;
}

export interface ClassWithSubjectsResponse {
  class: {
    id: string;
    name: string;
    description: string | null;
    subjects: Array<{
      id: string;
      name: string;
      code: string | null;
      class_subject_id: string;
    }>;
  };
}

// Subject types
export interface SubjectResponse {
  subjects: Subject[];
}

// Fee structure types (MonthlyLedgerEntry defined above in Core entity types)

export interface FeeStructureResponse {
  message?: string;
  fee_structure: {
    id: string;
    student_id: string;
    class_fee_id: string;
    class_fee_discount?: number;
    transport_enabled?: boolean;
    transport_route_id?: string | null;
    transport_fee_discount?: number;
    other_fees?: any;
    custom_fees?: any;
  } | null;
  monthly_ledger: MonthlyLedgerEntry[];
}

// Student types
export interface StudentResponse {
  students: Array<{
    id: string;
    roll_number: string;
    status: string;
    profile_id: string;
    profile: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
    };
  }>;
}

export interface StudentsAdminResponse {
  classes: Array<{
    id: string;
    name: string;
    description?: string | null;
    students: Array<{
      id: string;
      roll_number: string | null;
      section_id?: string;
      profile: {
        id: string;
        full_name: string;
        email: string;
      };
    }>;
  }>;
  unassigned?: Array<{
    id: string;
    roll_number: string | null;
    profile: {
      id: string;
      full_name: string;
      email: string;
    };
  }>;
  students?: Array<any>;
  total_students?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more?: boolean;
  };
}

// Assignment types
export interface AssignmentResponse {
  assignments: Array<{
    id: string;
    class_group_id: string;
    subject_id: string;
    section_id: string | null;
    class_groups: {
      id: string;
      name: string;
      description: string | null;
    };
    subjects: {
      id: string;
      name: string;
      code: string | null;
    };
    sections: {
      id: string;
      name: string;
    } | null;
  }>;
}

// Exam types
export interface ExamResponse {
  exams: Array<{
    id: string;
    name: string;
    term: string | null;
    start_date: string;
    end_date: string;
    created_at: string;
  }>;
}

// Classification types
export interface ClassificationTypeResponse {
  types: Array<{
    id: string;
    name: string;
    display_order: number;
    created_at: string;
  }>;
}

export interface ClassificationValueResponse {
  values: Array<{
    id: string;
    classification_type_id: string;
    value: string;
    display_order: number;
    created_at: string;
  }>;
}

// Fee types
export interface ClassFeeResponse {
  class_fees: Array<{
    id: string;
    class_id: string;
    amount: number;
    fee_cycle: string;
    due_day: number;
    created_at: string;
  }>;
  fees?: Array<any>;
}

export interface DefaultFeesResponse {
  default_fees?: Array<{
    id: string;
    amount: number;
    fee_cycle: string;
  }>;
  class_fees: Array<any>;
  transport_routes: Array<any>;
  other_fee_categories: Array<any>;
  optional_fees: Array<any>;
  custom_fees: Array<any>;
}

export interface CustomFeeResponse {
  custom_fees: Array<{
    id: string;
    student_id: string;
    amount: number;
    description: string;
    created_at: string;
  }>;
}

// Salary types
export interface SalaryStructureResponse {
  structure: {
    id: string;
    base_salary: number;
    hra: number;
    other_allowances: number;
    fixed_deductions: number;
    salary_cycle: string;
    attendance_based_deduction: boolean;
  } | null;
}

export interface SalaryRecordsResponse {
  records: Array<{
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
  }>;
}

export interface SalaryDataResponse {
  structure: SalaryStructureResponse['structure'];
  records: SalaryRecordsResponse['records'];
}

// School types
export interface SchoolInfoResponse {
  school: {
    id: string;
    name: string;
    join_code: string;
    registration_number: string | null;
    address: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    logo_url: string | null;
    created_at: string;
  };
}

// Dashboard types
export interface DashboardStatsResponse {
  stats: {
    totalStudents: number;
    totalStaff: number;
    totalClasses: number;
    studentsByGender: {
      total: number;
      male: number;
      female: number;
      other: number;
      unknown: number;
    };
    staffByGender: {
      total: number;
      male: number;
      female: number;
      other: number;
      unknown: number;
    };
  };
}

// Generic response types
export interface CreateResponse {
  id: string;
  message?: string;
}

export interface UpdateResponse {
  message?: string;
  [key: string]: any;
}

export interface UsernameCheckResponse {
  available: boolean;
  message?: string;
}

// Payment types
export interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_type: 'salary' | 'advance' | 'adjustment' | 'bonus' | 'loan' | 'other';
  payment_type_label: string;
  payment_mode: 'bank' | 'cash' | 'upi';
  payment_proof: string | null;
  notes: string | null;
  salary_month: number | null;
  salary_year: number | null;
  salary_period_label: string | null;
  paid_by_name: string | null;
  paid_by_email: string | null;
  running_total: number;
  created_at: string;
}

export interface PaymentSummary {
  total_paid: number;
  total_payments: number;
  average_payment: number;
  pending_amount: number;
  total_paid_till_date: number;
  by_type: Record<string, number>;
  by_mode: Record<string, number>;
  date_range: {
    first_payment_date: string | null;
    last_payment_date: string | null;
  };
}

export interface PaymentHistoryResponse {
  payments: Payment[];
  summary: PaymentSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Fee collection response
export interface CollectFeeResponse {
  id: string;
  message?: string;
  payment?: {
    id: string;
    amount_paid?: number;
    payment_amount?: number;
    payment_date?: string;
    payment_mode?: string;
    transaction_id?: string;
    cheque_number?: string;
    bank_name?: string;
    notes?: string;
  };
  excess_amount?: number;
  credit_applied?: {
    applied_amount?: number;
    months_applied?: number;
    remaining_credit?: number;
  };
  selectedComponents?: any[];
}

// Salary payment response
export interface RecordSalaryPaymentResponse {
  id: string;
  message?: string;
  excess_amount?: number;
  credit_applied?: {
    applied_amount?: number;
    months_applied?: number;
    remaining_credit?: number;
  };
}

// Analytics response - matches AnalyticsData interface in UnpaidFeeAnalytics.tsx
export interface UnpaidFeeAnalyticsResponse {
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
      total_months_due_names: string[];
      paid_months: number;
      paid_months_names: string[];
      pending_months: number;
      pending_months_names: string[];
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
