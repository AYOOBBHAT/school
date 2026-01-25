export interface StudentProfile {
  id: string;
  roll_number: string;
  status: string;
  admission_date: string;
  class_groups?: {
    id: string;
    name: string;
    description: string;
  };
  sections?: {
    id: string;
    name: string;
  };
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string;
  };
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  created_at: string;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendancePercentage: number;
}

export interface Mark {
  exam: {
    id: string;
    name: string;
    term: string;
    start_date: string;
    end_date: string;
  };
  subjects: Array<{
    subject: {
      id: string;
      name: string;
      code: string;
    };
    marks_obtained: number;
    max_marks: number;
    percentage: string;
  }>;
  overallPercentage: string;
  total?: number;
  totalMax?: number;
  average?: number;
  grade?: string;
}

export interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  description: string;
  totalPaid: number;
  remaining: number;
  isPaid: boolean;
  isOverdue: boolean;
  payments: Array<{
    id: string;
    amount_paid: number;
    payment_date: string;
    payment_mode: string;
    transaction_id: string;
  }>;
}

export interface FeeSummary {
  totalAssigned: number;
  totalPaid: number;
  totalPending: number;
  transportFee: number;
}
