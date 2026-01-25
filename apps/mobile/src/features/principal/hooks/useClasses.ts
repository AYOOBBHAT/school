import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadClasses, createClass } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';
import { ClassGroup } from '../../../shared/types';

export function useClasses() {
  return useQuery({
    queryKey: queryKeys.principal.classes,
    queryFn: loadClasses,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createClass,
    onMutate: async (newClass) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.principal.classes });

      const previous = queryClient.getQueryData<{ classes: ClassGroup[] }>(queryKeys.principal.classes);

      queryClient.setQueryData<{ classes: ClassGroup[] }>(queryKeys.principal.classes, (old) => {
        if (!old) return { classes: [] };
        return {
          // Skip optimistic update - mutation will refetch on success
          classes: old.classes,
        };
      });

      return { previous };
    },
    onError: (_err, _newClass, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.principal.classes, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.classes });
    },
  });
}
