import { API_URL } from '../utils/api';
import {
  StaffResponse,
  ClassResponse,
  SubjectResponse,
  AssignmentResponse,
  StudentsAdminResponse,
  ClassFeeResponse,
  CustomFeeResponse,
  ClassificationTypeResponse,
  ClassificationValueResponse,
  ExamResponse,
  CreateResponse,
  UpdateResponse,
  UsernameCheckResponse,
  SchoolInfoResponse,
  DashboardStatsResponse,
  DefaultFeesResponse
} from './types';

// Staff Management
export async function loadStaff(token: string): Promise<StaffResponse> {
  const response = await fetch(`${API_URL}/staff-admin`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load staff' }));
    throw new Error(errorData.error || `Failed to load staff: ${response.status}`);
  }

  return await response.json();
}

export async function loadAllClasses(token: string): Promise<ClassResponse> {
  const response = await fetch(`${API_URL}/classes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { classes: [] };
  }

  return await response.json();
}

export async function loadAllSubjects(token: string): Promise<SubjectResponse> {
  const response = await fetch(`${API_URL}/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { subjects: [] };
  }

  return await response.json();
}

export async function loadAllAssignments(token: string): Promise<AssignmentResponse> {
  const response = await fetch(`${API_URL}/teacher-assignments`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { assignments: [] };
  }

  return await response.json();
}

export async function loadAttendanceAssignments(token: string): Promise<AssignmentResponse> {
  const response = await fetch(`${API_URL}/teacher-attendance-assignments`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { assignments: [] };
  }

  return await response.json();
}

export async function loadSections(token: string, classId: string): Promise<{ sections: Array<{ id: string; name: string; class_id: string }> }> {
  const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { sections: [] };
  }

  return await response.json();
}

export async function loadTeacherAttendance(token: string, teacherId: string): Promise<{
  attendance: Array<{ date: string; status: string; notes?: string }>;
  summary?: { total: number; present: number; absent: number; late: number } | null;
}> {
  const response = await fetch(`${API_URL}/teacher-attendance?teacher_id=${teacherId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { attendance: [], summary: undefined };
  }

  const data = await response.json();
  return {
    attendance: data.attendance || [],
    summary: data.summary || null
  };
}

export async function markTeacherAttendance(
  token: string,
  data: { teacher_id: string; date: string; status: string; notes?: string }
): Promise<void> {
  const response = await fetch(`${API_URL}/teacher-attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to mark attendance');
  }
}

export async function loadTeacherPerformance(token: string, teacherId: string): Promise<{
  performance: {
    total_classes: number;
    total_students: number;
    attendance_rate: number;
    average_marks: number;
  };
}> {
  const response = await fetch(`${API_URL}/staff-admin/${teacherId}/performance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load performance data');
  }

  return await response.json();
}

export async function updateTeacher(token: string, teacherId: string, data: any): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/staff-admin/${teacherId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update teacher');
  }

  return await response.json();
}

export async function loadTeacherAssignments(token: string, teacherId: string): Promise<AssignmentResponse> {
  const response = await fetch(`${API_URL}/teacher-assignments/teacher/${teacherId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { assignments: [] };
  }

  return await response.json();
}

export async function loadTeacherAttendanceAssignments(token: string, teacherId: string): Promise<AssignmentResponse> {
  const response = await fetch(`${API_URL}/teacher-attendance-assignments/teacher/${teacherId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { assignments: [] };
  }

  return await response.json();
}

export async function createTeacherAssignment(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/teacher-assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create assignment');
  }

  return await response.json();
}

export async function createAttendanceAssignment(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/teacher-attendance-assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create attendance assignment');
  }

  return await response.json();
}

export async function deleteAssignment(token: string, assignmentId: string): Promise<void> {
  const response = await fetch(`${API_URL}/teacher-assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete assignment');
  }
}

export async function loadDailyAttendance(
  token: string,
  teacherId: string,
  startDate: string,
  endDate: string
): Promise<{ attendance: Array<{ date: string; status: string }>; summary?: { total: number; present: number; absent: number; late: number } | null }> {
  const response = await fetch(
    `${API_URL}/teacher-attendance?teacher_id=${teacherId}&start_date=${startDate}&end_date=${endDate}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    return { attendance: [], summary: null };
  }

  return await response.json();
}

export async function saveDailyAttendance(token: string, data: {
  teacher_id: string;
  start_date: string;
  end_date: string;
  absent_dates: string[];
}): Promise<void> {
  const response = await fetch(`${API_URL}/teacher-attendance/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save attendance');
  }
}

export async function createStaff(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/principal-users/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add staff member');
  }

  return await response.json();
}

export async function deleteAttendanceAssignment(token: string, assignmentId: string): Promise<void> {
  const response = await fetch(`${API_URL}/teacher-attendance-assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete attendance assignment');
  }
}

// Classes Management
export async function loadSubjects(token: string): Promise<SubjectResponse> {
  const response = await fetch(`${API_URL}/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { subjects: [] };
  }

  return await response.json();
}

export async function loadClasses(token: string): Promise<ClassResponse> {
  const response = await fetch(`${API_URL}/classes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load classes' }));
    throw new Error(errorData.error || `Failed to load classes: ${response.status}`);
  }

  return await response.json();
}

export async function createClass(token: string, data: {
  name: string;
  description?: string;
  classification_value_ids?: string[];
}): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      classification_value_ids: data.classification_value_ids && data.classification_value_ids.length > 0 ? data.classification_value_ids : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create class');
  }

  return await response.json();
}

export async function loadClassSubjects(token: string, classId: string): Promise<SubjectResponse> {
  const response = await fetch(`${API_URL}/classes/${classId}/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { subjects: [] };
  }

  return await response.json();
}

export async function addSubjectToClass(token: string, classId: string, subjectId: string): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/classes/${classId}/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subject_id: subjectId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add subject');
  }

  return await response.json();
}

export async function deleteClassSubject(token: string, classId: string, classSubjectId: string): Promise<void> {
  const response = await fetch(`${API_URL}/classes/${classId}/subjects/${classSubjectId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove subject');
  }
}

export async function updateClass(token: string, classId: string, data: {
  name: string;
  description?: string;
  classification_value_ids?: string[];
}): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/classes/${classId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      classification_value_ids: data.classification_value_ids && data.classification_value_ids.length > 0 ? data.classification_value_ids : [],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update class');
  }

  return await response.json();
}

// Subjects Management
export async function loadAllSubjectsForManagement(token: string): Promise<SubjectResponse> {
  const response = await fetch(`${API_URL}/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load subjects' }));
    throw new Error(errorData.error || `Failed to load subjects: ${response.status}`);
  }

  return await response.json();
}

export async function createSubject(token: string, data: {
  name: string;
  code?: string | null;
}): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/subjects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name,
      code: data.code || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create subject');
  }

  return await response.json();
}

export async function deleteSubject(token: string, subjectId: string): Promise<void> {
  const response = await fetch(`${API_URL}/subjects/${subjectId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete subject');
  }
}

// Students Management
export async function checkUsername(token: string, username: string): Promise<UsernameCheckResponse> {
  const response = await fetch(`${API_URL}/principal-users/check-username/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { available: false, message: 'Username check failed' };
  }

  return await response.json();
}

export async function loadStudentsAdmin(token: string, params?: URLSearchParams): Promise<StudentsAdminResponse> {
  const url = params ? `${API_URL}/students-admin?${params.toString()}` : `${API_URL}/students-admin`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load students' }));
    throw new Error(errorData.error || `Failed to load students: ${response.status}`);
  }

  return await response.json();
}

export async function loadClassSections(token: string, classId: string): Promise<{ sections: Array<{ id: string; name: string; class_id: string }> }> {
  const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load sections');
  }

  return await response.json();
}

export async function loadDefaultFees(token: string, classId: string): Promise<DefaultFeesResponse> {
  const response = await fetch(`${API_URL}/principal-users/classes/${classId}/default-fees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load default fees');
  }

  return await response.json();
}

export async function loadStudentFeeConfig(token: string, studentId: string): Promise<{
  fee_config: {
    id: string;
    student_id: string;
    class_fee_id: string;
    class_fee_discount?: number;
    transport_enabled?: boolean;
    transport_route_id?: string | null;
    transport_fee_discount?: number;
    other_fees?: any;
    custom_fees?: any;
  } | null;
}> {
  const response = await fetch(`${API_URL}/students-admin/${studentId}/fee-config`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return await response.json().catch(() => ({ fee_config: null }));
  }

  return await response.json();
}

export async function updateStudent(token: string, studentId: string, data: any): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/students-admin/${studentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update student');
  }

  return await response.json();
}

export async function promoteStudent(token: string, studentId: string, data: {
  target_class_id: string;
}): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/students-admin/${studentId}/promote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to promote student');
  }

  return await response.json();
}

export async function promoteClass(token: string, classId: string, data: {
  target_class_id: string;
  clear_sections?: boolean;
}): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/students-admin/class/${classId}/promote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to promote class');
  }

  return await response.json();
}

export async function createStudent(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/principal-users/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add student');
  }

  return await response.json();
}

// Classifications Management
export async function loadClassificationTypes(token: string): Promise<ClassificationTypeResponse> {
  const response = await fetch(`${API_URL}/classifications/types`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to load classification types' }));
    throw new Error(errorData.error || `Failed to load classification types: ${response.status}`);
  }

  return await response.json();
}

export async function loadClassificationValues(token: string, typeId: string): Promise<ClassificationValueResponse> {
  const response = await fetch(`${API_URL}/classifications/types/${typeId}/values`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { values: [] }; // Return empty array for values, don't throw (used in loops)
  }

  return await response.json();
}

export async function createClassificationType(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/classifications/types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create classification type');
  }

  return await response.json();
}

export async function createClassificationValue(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/classifications/values`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create classification value');
  }

  return await response.json();
}

export async function updateClassificationType(token: string, typeId: string, data: any): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/classifications/types/${typeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update classification type');
  }

  return await response.json();
}

export async function deleteClassificationValue(token: string, valueId: string): Promise<void> {
  const response = await fetch(`${API_URL}/classifications/values/${valueId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to delete classification value');
  }
}

export async function deleteClassificationType(token: string, typeId: string): Promise<void> {
  const response = await fetch(`${API_URL}/classifications/types/${typeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to delete classification type');
  }
}

// Exams Management
export async function loadExamsForManagement(token: string): Promise<ExamResponse> {
  const response = await fetch(`${API_URL}/exams`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load exams');
  }

  return await response.json();
}

export async function createExam(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/exams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create exam');
  }

  return await response.json();
}

// Fees Management
export async function loadClassesForFees(token: string): Promise<ClassResponse> {
  const response = await fetch(`${API_URL}/classes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load classes for fees');
  }

  return await response.json();
}

export async function loadStudentsAdminForFees(token: string): Promise<StudentsAdminResponse & { students?: Array<any> }> {
  const response = await fetch(`${API_URL}/students-admin`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load students for fees');
  }

  return await response.json();
}

export async function loadClassFees(token: string, classId: string): Promise<ClassFeeResponse & { fees?: Array<any> }> {
  const response = await fetch(`${API_URL}/fees/class-fees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ class_id: classId }),
  });

  if (!response.ok) {
    return { class_fees: [] };
  }

  return await response.json();
}

export async function loadAllClassFees(token: string): Promise<ClassFeeResponse> {
  const response = await fetch(`${API_URL}/fees/class-fees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { class_fees: [] };
  }

  return await response.json();
}

export async function createClassFee(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/fees/class-fees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save class fee');
  }

  return await response.json();
}

export async function loadCustomFees(token: string, studentId?: string): Promise<CustomFeeResponse> {
  const url = studentId 
    ? `${API_URL}/fees/custom-fees?student_id=${studentId}`
    : `${API_URL}/fees/custom-fees`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { custom_fees: [] };
  }

  return await response.json();
}

export async function createCustomFee(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/fees/custom-fees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save custom fee');
  }

  return await response.json();
}

export async function deleteCustomFee(token: string, feeId: string): Promise<void> {
  const response = await fetch(`${API_URL}/fees/custom-fees/${feeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete custom fee');
  }
}

export async function loadTransportRoutes(token: string): Promise<{ routes: Array<{ id: string; name: string; distance: number }> }> {
  const response = await fetch(`${API_URL}/fees/transport/routes`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { routes: [] };
  }

  return await response.json();
}

export async function createTransportRoute(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/fees/transport/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save route');
  }

  return await response.json();
}

export async function loadTransportFees(token: string): Promise<{ transport_fees: Array<{ id: string; route_id: string; amount: number }> }> {
  const response = await fetch(`${API_URL}/fees/transport/fees`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { transport_fees: [] };
  }

  return await response.json();
}

export async function createTransportFee(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/fees/transport/fees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save transport fee');
  }

  return await response.json();
}

export async function loadFeeVersions(token: string, feeType: 'class' | 'transport' | 'custom', feeId: string): Promise<{ versions: Array<{ id: string; amount: number; effective_from: string }> }> {
  let url = '';
  if (feeType === 'class') {
    url = `${API_URL}/fees/class-fees/${feeId}/versions`;
  } else if (feeType === 'transport') {
    url = `${API_URL}/fees/transport/fees/${feeId}/versions`;
  } else if (feeType === 'custom') {
    url = `${API_URL}/fees/custom-fees/${feeId}/versions`;
  }

  if (!url) {
    return { versions: [] };
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { versions: [] };
  }

  return await response.json();
}

export async function hikeClassFee(token: string, feeId: string, data: {
  new_amount: number;
  effective_from_date: string;
  notes?: string;
}): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/fees/class-fees/${feeId}/hike`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to hike fee');
  }

  return await response.json();
}

export async function hikeTransportFee(token: string, feeId: string, data: {
  new_amount: number;
  effective_from_date: string;
  notes?: string;
}): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/fees/transport/fees/${feeId}/hike`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to hike fee');
  }

  return await response.json();
}

export async function updateCustomFee(token: string, feeId: string, data: any): Promise<UpdateResponse> {
  const response = await fetch(`${API_URL}/fees/custom-fees/${feeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update fee');
  }

  return await response.json();
}

// Salary Management
export async function loadStudentsForSalary(token: string): Promise<{ students: Array<{ id: string; profile: { full_name: string } }> }> {
  const response = await fetch(`${API_URL}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load students for salary');
  }

  return await response.json();
}

export async function loadSalaryStructures(token: string): Promise<{ structures: Array<{ id: string; base_salary: number; hra: number }> }> {
  const response = await fetch(`${API_URL}/salary/structures`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { structures: [] };
  }

  return await response.json();
}

export async function loadUnpaidSalaries(token: string, timeScope: string = 'last_12_months'): Promise<{ teachers: Array<{ id: string; name: string; unpaid_amount: number }> }> {
  const response = await fetch(`${API_URL}/salary/unpaid?time_scope=${timeScope}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { teachers: [] };
  }

  return await response.json();
}

export async function createSalaryStructure(token: string, data: any): Promise<CreateResponse> {
  const response = await fetch(`${API_URL}/salary/structure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save structure');
  }

  return await response.json();
}

/**
 * Load school information
 * @param token - Authentication token
 * @returns School information object
 */
export async function loadSchoolInfo(token: string): Promise<SchoolInfoResponse['school']> {
  const response = await fetch(`${API_URL}/school/info`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load school info');
  }

  const data = await response.json();
  // Handle both { school: {...} } and direct school object
  const schoolData = data.school || data;
  if (schoolData && typeof schoolData === 'object' && !Array.isArray(schoolData)) {
    return schoolData;
  }
  throw new Error('Unexpected school data format');
}

/**
 * Load dashboard statistics
 * @param token - Authentication token
 * @returns Dashboard statistics object
 */
export async function loadDashboardStats(token: string): Promise<DashboardStatsResponse['stats']> {
  const response = await fetch(`${API_URL}/dashboard/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load dashboard stats');
  }

  const data = await response.json();
  return data?.stats;
}
