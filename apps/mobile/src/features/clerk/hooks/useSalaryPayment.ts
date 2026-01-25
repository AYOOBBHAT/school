import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadUnpaidSalaries,
  recordSalaryPayment,
} from '../../../shared/services/clerk.service';
import { queryKeys } from '../../../shared/queryKeys';
import { UnpaidSalaryTeacher } from '../../../shared/types';

export function useUnpaidSalaries(timeScope: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: queryKeys.clerk.unpaidSalaries(timeScope, page, limit),
    queryFn: () => loadUnpaidSalaries(timeScope, page, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes - salary data changes with payments
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useRecordSalaryPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: recordSalaryPayment,
    onMutate: async (paymentData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.clerk.unpaidSalaries('last_12_months') });

      // Snapshot previous value
      const previous = queryClient.getQueryData(
        queryKeys.clerk.unpaidSalaries('last_12_months')
      );

      // Optimistically update - remove the paid amount from unpaid
      queryClient.setQueryData<{
        summary: unknown;
        teachers: UnpaidSalaryTeacher[];
        pagination: unknown;
      }>(
        queryKeys.clerk.unpaidSalaries('last_12_months'),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            teachers: old.teachers?.map((teacher: UnpaidSalaryTeacher) => {
              if (teacher.teacher_id === paymentData.teacher_id) {
                return {
                  ...teacher,
                  total_unpaid_amount: Math.max(0, teacher.total_unpaid_amount - paymentData.amount),
                };
              }
              return teacher;
            }),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _paymentData, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.clerk.unpaidSalaries('last_12_months'), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate only the specific time scope query that was updated
      // Note: We invalidate all time scopes since payment affects all views
      queryClient.invalidateQueries({ 
        queryKey: ['clerk', 'unpaid-salaries'],
        exact: false 
      });
    },
  });
}
