import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadStudents,
  loadClasses,
  loadStudentMonthlyLedger,
  collectFeePayment,
} from '../../../shared/services/clerk.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useClerkStudents() {
  return useQuery({
    queryKey: queryKeys.clerk.students,
    queryFn: loadStudents,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useClerkClasses() {
  return useQuery({
    queryKey: queryKeys.clerk.classes,
    queryFn: loadClasses,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useStudentMonthlyLedger(studentId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.clerk.studentLedger(studentId),
    queryFn: () => loadStudentMonthlyLedger(studentId),
    enabled: enabled && !!studentId,
    staleTime: 2 * 60 * 1000, // 2 minutes - fee data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useCollectFeePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: collectFeePayment,
    onMutate: async (paymentData) => {
      // Cancel any outgoing refetches for the student ledger
      const studentId = paymentData.monthly_fee_component_ids[0]?.split('_')[0];
      if (studentId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.clerk.studentLedger(studentId) });
        const previous = queryClient.getQueryData(queryKeys.clerk.studentLedger(studentId));
        return { previous, studentId };
      }
      return {};
    },
    onError: (_err, _paymentData, context) => {
      // Rollback on error
      if (context?.previous && context?.studentId) {
        queryClient.setQueryData(queryKeys.clerk.studentLedger(context.studentId), context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      // Invalidate only the specific student ledger that was updated
      const studentId = variables.monthly_fee_component_ids[0]?.split('_')[0];
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.clerk.studentLedger(studentId) });
      }
      // Invalidate fee analytics queries (they depend on fee payment data)
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.clerk.feeAnalytics({}),
        exact: false 
      });
    },
  });
}
