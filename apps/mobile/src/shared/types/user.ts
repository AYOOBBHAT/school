export type UserRole = 'principal' | 'clerk' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  schoolId: string;
  schoolName?: string | null;
}
