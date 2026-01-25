/**
 * Navigation Types for React Navigation
 * Defines all route parameters for each stack
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Root Stack (Auth + Role Selection)
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Principal: undefined;
  Teacher: undefined;
  Clerk: undefined;
  Student: undefined;
};

// Principal Stack
export type PrincipalStackParamList = {
  Students: undefined;
  Classes: undefined;
  Staff: undefined;
  Subjects: undefined;
  Exams: undefined;
  Classifications: undefined;
  Salary: undefined;
  Fees: undefined;
};

// Teacher Stack
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
