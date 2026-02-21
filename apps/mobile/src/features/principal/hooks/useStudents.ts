import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadStudentsAdmin,
  createStudent,
  updateStudent,
  promoteStudent,
  promoteClass,
  type CreateStudentPayload,
  type StudentsAdminResponse,
} from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';

/** Load students by class + unassigned (same as web principal/students) */
export function useStudents() {
  return useQuery({
    queryKey: queryKeys.principal.students,
    queryFn: loadStudentsAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentPayload) => createStudent(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.students });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, data }: { studentId: string; data: Parameters<typeof updateStudent>[1] }) =>
      updateStudent(studentId, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.students });
    },
  });
}

export function usePromoteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, target_class_id }: { studentId: string; target_class_id: string }) =>
      promoteStudent(studentId, { target_class_id }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.students });
    },
  });
}

export function usePromoteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, data }: { classId: string; data: { target_class_id: string; clear_sections?: boolean } }) =>
      promoteClass(classId, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.students });
    },
  });
}
