import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadStudents, createStudent } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';
import { Student } from '../../../shared/types';

export function useStudents() {
  return useQuery({
    queryKey: queryKeys.principal.students,
    queryFn: loadStudents,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createStudent,
    onMutate: async (newStudent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.principal.students });

      // Snapshot previous value
      const previous = queryClient.getQueryData<{ students: Student[] }>(queryKeys.principal.students);

      // Optimistically update - skip optimistic update since newStudent is not a full Student object
      // The mutation will refetch on success anyway

      return { previous };
    },
    onError: (_err, _newStudent, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.principal.students, context.previous);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.students });
    },
  });
}
