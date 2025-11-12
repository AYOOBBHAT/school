export type Role = 'principal' | 'clerk' | 'teacher' | 'student' | 'parent';

export interface School {
  id: string;
  name: string;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  logo_url?: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  school_id: string;
  role: Role;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface FeeStructure {
  id: string;
  school_id: string;
  class_group_id: string;
  name: string;
  amount: number;
  due_date?: string | null;
  description?: string | null;
}

export interface Payment {
  id: string;
  student_id: string;
  fee_structure_id: string;
  amount_paid: number;
  payment_date: string;
  payment_mode: 'cash' | 'online' | 'upi' | 'card';
  transaction_id?: string | null;
  received_by: string;
  school_id: string;
}


