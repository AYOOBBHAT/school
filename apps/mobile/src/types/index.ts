export type UserRole = 'principal' | 'clerk' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  schoolId: string;
  schoolName?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Student {
  id: string;
  roll_number: string;
  status: string;
  class_group_id: string;
  profile_id: string;
  class_groups?: {
    id: string;
    name: string;
  };
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface ClassGroup {
  id: string;
  name: string;
  description?: string;
  school_id: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  school_id: string;
}

export interface Attendance {
  id?: string;
  student_id: string;
  class_group_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
}

export interface Mark {
  id?: string;
  student_id: string;
  subject_id: string;
  exam_id: string;
  marks_obtained: number;
  max_marks: number;
  remarks?: string;
}

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
}

export interface DashboardStats {
  total_students?: number;
  total_teachers?: number;
  total_classes?: number;
  pending_approvals?: number;
  today_attendance?: number;
  recent_payments?: number;
}

