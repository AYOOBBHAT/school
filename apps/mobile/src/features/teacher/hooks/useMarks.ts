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

export function useStudentsForMarks(
  params: {
    class_group_id: string;
    exam_id: string;
    subject_id: string;
  },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.teacher.studentsForMarks(params),
    queryFn: () => loadStudentsForMarks(params),
    enabled: enabled && !!params.class_group_id && !!params.exam_id && !!params.subject_id,
    staleTime: 2 * 60 * 1000, // 2 minutes - marks data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useSubmitMarks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: submitMarksBulk,
    onMutate: async (newMarks) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.teacher.marks });

      // Optimistically update marks
      const examId = newMarks[0]?.exam_id;
      const subjectId = newMarks[0]?.subject_id;
      const classGroupId = newMarks[0]?.class_group_id;
      
      if (examId && subjectId && classGroupId) {
        const previous = queryClient.getQueryData(
          queryKeys.teacher.studentsForMarks({ class_group_id: classGroupId, exam_id: examId, subject_id: subjectId })
        );

        // The marks are already submitted, so we just invalidate
        return { previous, examId, subjectId, classGroupId };
      }
      return {};
    },
    onError: (_err, _newMarks, context) => {
      // Rollback on error if needed
      if (context?.previous && context?.examId && context?.subjectId && context?.classGroupId) {
        queryClient.setQueryData(
          queryKeys.teacher.studentsForMarks({
            class_group_id: context.classGroupId,
            exam_id: context.examId,
            subject_id: context.subjectId,
          }),
          context.previous
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate only the specific marks query that was updated
      const examId = variables[0]?.exam_id;
      const subjectId = variables[0]?.subject_id;
      const classGroupId = variables[0]?.class_group_id;
      if (examId && subjectId && classGroupId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.teacher.studentsForMarks({
            class_group_id: classGroupId,
            exam_id: examId,
            subject_id: subjectId,
          }),
        });
      }
    },
  });
}
