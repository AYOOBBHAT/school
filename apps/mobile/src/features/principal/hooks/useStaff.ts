import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadStaff, createStaff } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';
import { Staff } from '../../../shared/types';

export function useStaff() {
  return useQuery({
    queryKey: queryKeys.principal.staff,
    queryFn: loadStaff,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createStaff,
    onMutate: async (newStaff) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.principal.staff });

      const previous = queryClient.getQueryData<{ staff: Staff[] }>(queryKeys.principal.staff);

      queryClient.setQueryData<{ staff: Staff[] }>(queryKeys.principal.staff, (old) => {
        if (!old) return { staff: [] };
        return {
          // Skip optimistic update - mutation will refetch on success
          staff: old.staff,
        };
      });

      return { previous };
    },
    onError: (_err, _newStaff, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.principal.staff, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.staff });
    },
  });
}
