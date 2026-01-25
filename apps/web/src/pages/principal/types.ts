export interface GenderBreakdown {
  total: number;
  male: number;
  female: number;
  other: number;
  unknown: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  studentsByGender: GenderBreakdown;
  staffByGender: GenderBreakdown;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  gender?: string;
  role: string;
  approval_status: string;
  created_at: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
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
}

export interface Student {
  id: string;
  profile_id: string;
  roll_number: string;
  status: string;
  profile?: Profile;
}

export interface DoughnutChartProps {
  title: string;
  breakdown: GenderBreakdown;
  colors?: {
    male: string;
    female: string;
    other: string;
    unknown: string;
  };
}

export interface ClassWithStudents {
  id: string;
  name: string;
  description?: string | null;
  classifications?: Array<{
    type: string;
    value: string;
    type_id: string;
    value_id: string;
  }>;
  students: Array<{
    id: string;
    roll_number: string | null;
    status?: string;
    admission_date?: string;
    section_id?: string | undefined;
    section_name?: string | null;
    profile?: {
      id: string;
      full_name: string;
      email: string;
      phone?: string;
      gender?: string;
      role?: string;
      approval_status?: string;
      created_at?: string;
    };
  }>;
  student_count?: number;
}

export interface ClassificationType {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface ClassificationValue {
  id: string;
  classification_type_id: string;
  value: string;
  display_order: number;
  created_at: string;
}
