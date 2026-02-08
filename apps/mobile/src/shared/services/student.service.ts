import { api } from './api';

/**
 * Student Service
 * Handles all student-related API calls
 * Matches web app API endpoints and response structures
 */

// Student Profile
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

export async function loadProfile(): Promise<{ student: StudentProfile }> {
  return api.get<{ student: StudentProfile }>('/students/profile');
}

// Attendance
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

export async function loadAttendance(): Promise<{
  attendance: AttendanceRecord[];
  summary: AttendanceSummary;
}> {
  return api.get<{
    attendance: AttendanceRecord[];
    summary: AttendanceSummary;
  }>('/students/attendance');
}

// Marks
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
}

export async function loadMarks(): Promise<{ marks: Mark[] }> {
  return api.get<{ marks: Mark[] }>('/students/marks');
}

// Fees
export interface FeeSummary {
  student_id: string;
  total_fee: number;
  paid_amount: number;
  pending_amount: number;
}

export interface FeeBill {
  id: string;
  bill_no: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'partial' | 'paid';
  created_at: string;
}

export interface FeePayment {
  id: string;
  bill_id: string | null;
  amount: number;
  payment_date: string;
  method: string;
  created_at: string;
}

export async function loadFees(): Promise<{
  summary: FeeSummary;
  bills: FeeBill[];
  payments: FeePayment[];
}> {
  return api.get<{
    summary: FeeSummary;
    bills: FeeBill[];
    payments: FeePayment[];
  }>('/students/fees');
}
