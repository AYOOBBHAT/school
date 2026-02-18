import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadExams,
  loadStudentsForMarks,
  submitMarksBulk,
} from '../../../shared/services/teacher.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useExams() {
  return useQuery({
    queryKey: queryKeys.teacher.exams,
    queryFn: loadExams,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

/** Load students for marks entry by class only (same as web). Exam/subject are only for submit. */
export function useStudentsForMarks(class_group_id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.teacher.studentsForMarks(class_group_id),
    queryFn: () => loadStudentsForMarks(class_group_id),
    enabled: enabled && !!class_group_id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

export function useSubmitMarks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: submitMarksBulk,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.teacher.marks });
      return {};
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students-for-marks'] });
    },
  });
}
