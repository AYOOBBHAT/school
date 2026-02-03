import { API_URL } from '../utils/api';
import { AssignmentResponse, ExamResponse } from './types';

/**
 * Load teacher assignments
 * @param token - Authentication token
 * @param userId - Teacher user ID
 * @returns Array of assignments
 */
export async function loadTeacherAssignments(token: string, userId: string): Promise<AssignmentResponse> {
  const response = await fetch(`${API_URL}/teacher-assignments/teacher/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load assignments');
  }

  return await response.json();
}

/**
 * Load exams
 * @param token - Authentication token
 * @returns Array of exams
 */
export async function loadExams(token: string): Promise<ExamResponse['exams']> {
  const response = await fetch(`${API_URL}/exams`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load exams');
  }

  const data = await response.json();
  return data.exams || [];
}

/**
 * Load classes for marks entry
 * @param token - Authentication token
 * @param userId - Teacher user ID
 * @returns Array of unique classes
 */
export async function loadClassesForMarks(token: string, userId: string): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${API_URL}/teacher-assignments/teacher/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load classes');
  }

  const data = await response.json();
  const assignments = data.assignments || [];
  
  const uniqueClasses = new Map();
  assignments.forEach((assignment: any) => {
    if (!uniqueClasses.has(assignment.class_group_id)) {
      uniqueClasses.set(assignment.class_group_id, {
        id: assignment.class_group_id,
        name: assignment.class_groups.name
      });
    }
  });
  
  return Array.from(uniqueClasses.values());
}

/**
 * Load subjects for marks entry
 * @param token - Authentication token
 * @param userId - Teacher user ID
 * @param selectedClass - Selected class group ID
 * @returns Array of unique subjects
 */
export async function loadSubjectsForMarks(token: string, userId: string, selectedClass: string): Promise<Array<{ id: string; name: string; code: string | null }>> {
  if (!selectedClass) return [];

  const response = await fetch(`${API_URL}/teacher-assignments/teacher/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load subjects');
  }

  const data = await response.json();
  const assignments = data.assignments || [];
  
  const uniqueSubjects = new Map();
  assignments
    .filter((assignment: any) => assignment.class_group_id === selectedClass)
    .forEach((assignment: any) => {
      if (!uniqueSubjects.has(assignment.subject_id)) {
        uniqueSubjects.set(assignment.subject_id, {
          id: assignment.subject_id,
          name: assignment.subjects.name,
          code: assignment.subjects.code
        });
      }
    });
  
  return Array.from(uniqueSubjects.values());
}

/**
 * Load students for marks entry
 * @param token - Authentication token
 * @param selectedClass - Selected class group ID
 * @returns Array of students
 */
export async function loadStudentsForMarks(token: string, selectedClass: string): Promise<Array<{
  id: string;
  roll_number: string | null;
  section_name: string | null;
  profile: { id: string; full_name: string; email: string };
}>> {
  if (!selectedClass) return [];

  const params = new URLSearchParams({
    class_group_id: selectedClass,
  });

  const response = await fetch(`${API_URL}/students-admin?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load students');
  }

  const data = await response.json();
  const allStudents: Array<{
    id: string;
    roll_number: string | null;
    section_name: string | null;
    profile: { id: string; full_name: string; email: string };
  }> = [];
  if (data.classes) {
    data.classes.forEach((cls: any) => {
      if (cls.id === selectedClass) {
        // Get sections for this class to map section_id to section_name
        const sectionsMap: Record<string, string> = {};
        if (cls.sections) {
          cls.sections.forEach((section: any) => {
            sectionsMap[section.id] = section.name;
          });
        }
        cls.students.forEach((student: any) => {
          allStudents.push({
            ...student,
            section_name: student.section_id ? sectionsMap[student.section_id] || null : null
          });
        });
      }
    });
  }
  return allStudents;
}

/**
 * Load students for attendance (with optional section filter)
 * @param token - Authentication token
 * @param classGroupId - Class group ID
 * @param sectionId - Optional section ID to filter by
 * @returns Array of students
 */
export async function loadStudentsForAttendance(token: string, classGroupId: string, sectionId?: string): Promise<Array<{
  id: string;
  roll_number: string | null;
  section_id?: string;
  section_name: string | null;
  profile: { id: string; full_name: string; email: string };
}>> {
  const params = new URLSearchParams({
    class_group_id: classGroupId,
  });
  if (sectionId) {
    params.append('section_id', sectionId);
  }

  const response = await fetch(`${API_URL}/students-admin?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load students');
  }

  const data = await response.json();
  const allStudents: Array<{
    id: string;
    roll_number: string | null;
    section_id?: string;
    section_name: string | null;
    profile: { id: string; full_name: string; email: string };
  }> = [];
  if (data.classes) {
    data.classes.forEach((cls: any) => {
      if (cls.id === classGroupId) {
        // Get sections for this class to map section_id to section_name
        const sectionsMap: Record<string, string> = {};
        if (cls.sections) {
          cls.sections.forEach((section: any) => {
            sectionsMap[section.id] = section.name;
          });
        }
        cls.students.forEach((student: any) => {
          if (!sectionId || student.section_id === sectionId) {
            // Map cleanly - profile should come from backend query
            allStudents.push({
              id: student.id,
              roll_number: student.roll_number,
              section_id: student.section_id,
              section_name: student.section_id ? sectionsMap[student.section_id] || null : null,
              profile: student.profile
            });
          }
        });
      }
    });
  }
  return allStudents;
}

/**
 * Save marks in bulk
 * @param token - Authentication token
 * @param marksData - Array of marks records
 */
export async function saveMarks(
  token: string,
  marksData: Array<{
    student_id: string;
    exam_id: string;
    subject_id: string;
    marks_obtained: number;
    max_marks: number;
    school_id: string;
  }>
): Promise<void> {
  const response = await fetch(`${API_URL}/marks/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ marks: marksData }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save marks');
  }
}

/**
 * Load teacher salary data
 * @param token - Authentication token
 * @param userId - Teacher user ID
 * @returns Salary structure and records
 */
export async function loadSalaryData(token: string, userId: string): Promise<{
  structure: {
    id: string;
    base_salary: number;
    hra: number;
    other_allowances: number;
    fixed_deductions: number;
    salary_cycle: string;
    attendance_based_deduction: boolean;
  } | null;
  records: Array<{
    id: string;
    month: number;
    year: number;
    gross_salary: number;
    total_deductions: number;
    attendance_deduction: number;
    net_salary: number;
    status: string;
    payment_date: string | null;
    payment_mode: string | null;
    rejection_reason: string | null;
  }>;
}> {
  const [structureRes, recordsRes] = await Promise.all([
    fetch(`${API_URL}/salary/structure/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
    fetch(`${API_URL}/salary/records`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  ]);

  let structure = null;
  let records: any[] = [];

  if (structureRes.ok) {
    const data = await structureRes.json();
    structure = data.structure;
  }

  if (recordsRes.ok) {
    const data = await recordsRes.json();
    records = data.records || [];
  }

  return { structure, records };
}
