import { api } from './api';
import { 
  Student, 
  ClassGroup, 
  Subject, 
  Staff, 
  Exam, 
  DashboardStats,
  ClassificationType,
  SalarySummary
} from '../types';

/**
 * Principal Service
 * Handles all principal-related API calls
 */

// Students
export async function loadStudents(): Promise<{ students: Student[] }> {
  return api.get<{ students: Student[] }>('/students');
}

export async function createStudent(data: {
  email: string;
  password: string;
  full_name: string;
  roll_number: string;
  class_group_id: string;
}): Promise<{ success: boolean; student: Student }> {
  return api.post<{ success: boolean; student: Student }>('/students-admin', data);
}

// Classes
export async function loadClasses(): Promise<{ classes: ClassGroup[] }> {
  return api.get<{ classes: ClassGroup[] }>('/classes');
}

export async function createClass(data: {
  name: string;
  description?: string;
}): Promise<{ success: boolean; class: ClassGroup }> {
  return api.post<{ success: boolean; class: ClassGroup }>('/classes', data);
}

// Subjects
export async function loadSubjects(): Promise<{ subjects: Subject[] }> {
  return api.get<{ subjects: Subject[] }>('/subjects');
}

export async function createSubject(data: {
  name: string;
  code?: string;
}): Promise<{ success: boolean; subject: Subject }> {
  return api.post<{ success: boolean; subject: Subject }>('/subjects', data);
}

// Staff
export async function loadStaff(): Promise<{ staff: Staff[] }> {
  return api.get<{ staff: Staff[] }>('/staff-admin');
}

export async function createStaff(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'teacher' | 'clerk';
}): Promise<{ success: boolean; staff: Staff }> {
  return api.post<{ success: boolean; staff: Staff }>('/staff-admin', data);
}

// Exams
export async function loadExams(): Promise<{ exams: Exam[] }> {
  return api.get<{ exams: Exam[] }>('/exams');
}

// Classifications
export async function loadClassificationTypes(): Promise<{ types: ClassificationType[] }> {
  return api.get<{ types: ClassificationType[] }>('/classification-types');
}

// Salary
export async function loadSalarySummary(): Promise<{ summary: SalarySummary }> {
  return api.get<{ summary: SalarySummary }>('/salary/summary');
}

// Dashboard
export async function loadDashboard(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/dashboard');
}
