import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadSubjects, createSubject } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';
import { Subject } from '../../../shared/types';

export function useSubjects() {
  return useQuery({
    queryKey: queryKeys.principal.subjects,
    queryFn: loadSubjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createSubject,
    onMutate: async (newSubject) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.principal.subjects });

      const previous = queryClient.getQueryData<{ subjects: Subject[] }>(queryKeys.principal.subjects);

      queryClient.setQueryData<{ subjects: Subject[] }>(queryKeys.principal.subjects, (old) => {
        if (!old) return { subjects: [] };
        return {
          // Skip optimistic update - mutation will refetch on success
          subjects: old.subjects,
        };
      });

      return { previous };
    },
    onError: (_err, _newSubject, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.principal.subjects, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.subjects });
    },
  });
}
