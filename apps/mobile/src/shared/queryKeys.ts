/**
 * Centralized React Query keys
 * Use these instead of hardcoded strings for type safety and refactoring
 */
export const queryKeys = {
  principal: {
    students: ['principal', 'students'] as const,
    classes: ['principal', 'classes'] as const,
    subjects: ['principal', 'subjects'] as const,
    staff: ['principal', 'staff'] as const,
    exams: ['principal', 'exams'] as const,
    classifications: ['principal', 'classifications'] as const,
    salary: {
      summary: ['principal', 'salary', 'summary'] as const,
    },
    dashboard: ['principal', 'dashboard'] as const,
  },
  teacher: {
    assignments: (teacherId: string) => ['teacher', 'assignments', teacherId] as const,
    attendanceAssignments: (teacherId: string) => ['teacher', 'attendance-assignments', teacherId] as const,
    studentsForAttendance: (classGroupId: string, sectionId: string | undefined, date: string) =>
      ['teacher', 'students-for-attendance', classGroupId, sectionId, date] as const,
    attendanceForClass: (classGroupId: string, date: string) =>
      ['teacher', 'attendance-for-class', classGroupId, date] as const,
    attendance: ['teacher', 'attendance'] as const,
    exams: ['teacher', 'exams'] as const,
    studentsForMarks: (params: { class_group_id: string; exam_id: string; subject_id: string }) =>
      ['teacher', 'students-for-marks', params] as const,
    marks: ['teacher', 'marks'] as const,
    salary: ['teacher', 'salary'] as const,
  },
  clerk: {
    students: ['clerk', 'students'] as const,
    classes: ['clerk', 'classes'] as const,
    studentLedger: (studentId: string) => ['clerk', 'student-ledger', studentId] as const,
    feeAnalytics: (params: {
      class_group_id?: string;
      time_scope?: string;
      page?: number;
      limit?: number;
    }) => ['clerk', 'fee-analytics', params] as const,
    unpaidSalaries: (timeScope: string, page?: number, limit?: number) =>
      ['clerk', 'unpaid-salaries', timeScope, page, limit] as const,
    exams: ['clerk', 'exams'] as const,
    marksResults: (params: { class_group_id?: string; exam_id?: string }) =>
      ['clerk', 'marks-results', params] as const,
  },
  student: {
    profile: ['student', 'profile'] as const,
    attendance: () => ['student', 'attendance'] as const,
    marks: () => ['student', 'marks'] as const,
    fees: () => ['student', 'fees'] as const,
  },
} as const;
