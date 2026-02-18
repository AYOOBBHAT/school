/**
 * Navigation Types for React Navigation
 * Defines all route parameters for each stack
 */

import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

// Root Stack (Auth + Role Selection)
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Principal: undefined;
  Teacher: undefined;
  Clerk: undefined;
  Student: undefined;
};

// Principal Stack (order matches web sidebar: Dashboard, Staff, Students, …)
export type PrincipalStackParamList = {
  Dashboard: undefined;
  Students: undefined;
  Staff: undefined;
  Exams: undefined;
  Classifications: undefined;
  UnpaidFeeAnalytics: undefined;
  Salary: undefined;
  Fees: undefined;
};

// Teacher Stack (matches web: My Classes, Attendance, Marks Entry, My Salary, Student Fee Status)
export type TeacherStackParamList = {
  MyClasses: undefined;
  MarkAttendance: {
    assignmentId?: string;
    classGroupId?: string;
    sectionId?: string;
    date?: string;
  };
  EnterMarks: {
    assignmentId?: string;
    classGroupId?: string;
    subjectId?: string;
    examId?: string;
  };
  MySalary: undefined;
  StudentFeeStatus: undefined;
};

// Clerk Stack
export type ClerkStackParamList = {
  FeeCollection: undefined;
  SalaryPayment: undefined;
  MarksResults: undefined;
};

// Student Stack
export type StudentStackParamList = {
  Overview: undefined;
  MyAttendance: undefined;
  MyMarks: undefined;
  MyFees: undefined;
};

// Screen Props Types
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type PrincipalStackScreenProps<T extends keyof PrincipalStackParamList> = NativeStackScreenProps<
  PrincipalStackParamList,
  T
>;

export type TeacherStackScreenProps<T extends keyof TeacherStackParamList> = NativeStackScreenProps<
  TeacherStackParamList,
  T
>;

export type ClerkStackScreenProps<T extends keyof ClerkStackParamList> = NativeStackScreenProps<
  ClerkStackParamList,
  T
>;

export type StudentStackScreenProps<T extends keyof StudentStackParamList> = NativeStackScreenProps<
  StudentStackParamList,
  T
>;

// Navigation prop types for use inside each stack (so navigate('ScreenName') is typed correctly)
export type PrincipalStackNavigationProp = NativeStackNavigationProp<PrincipalStackParamList>;
export type TeacherStackNavigationProp = NativeStackNavigationProp<TeacherStackParamList>;
export type ClerkStackNavigationProp = NativeStackNavigationProp<ClerkStackParamList>;
export type StudentStackNavigationProp = NativeStackNavigationProp<StudentStackParamList>;
