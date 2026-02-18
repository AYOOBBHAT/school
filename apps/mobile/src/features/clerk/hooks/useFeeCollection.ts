import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadClasses,
  loadStudentsForFeeCollection,
  loadStudentFeeStructure,
  loadStudentPayments,
  collectFeePayment,
} from '../../../shared/services/clerk.service';
import { queryKeys } from '../../../shared/queryKeys';

/** Load students for fee collection (same as web: students-admin with optional class filter). */
export function useStudentsForFeeCollection(classGroupId: string | undefined, page: number = 1, limit: number = 50) {
  return useQuery({
    queryKey: queryKeys.clerk.studentsForFeeCollection(classGroupId, page, limit),
    queryFn: () => loadStudentsForFeeCollection(classGroupId, page, limit),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

/** Legacy: flat students list - use useStudentsForFeeCollection for fee collection. */
export function useClerkStudents() {
  return useStudentsForFeeCollection(undefined, 1, 100);
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

/** Load student fee structure + monthly ledger (same as web: clerk-fees/student/:id/fee-structure). */
export function useStudentFeeStructure(studentId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.clerk.studentLedger(studentId),
    queryFn: () => loadStudentFeeStructure(studentId),
    enabled: enabled && !!studentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

/** Alias: returns ledger + fee_structure + message from fee-structure endpoint. */
export function useStudentMonthlyLedger(studentId: string, enabled: boolean = true) {
  return useStudentFeeStructure(studentId, enabled);
}

export function useStudentPayments(studentId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.clerk.studentPayments(studentId),
    queryFn: () => loadStudentPayments(studentId),
    enabled: enabled && !!studentId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export type CollectFeePaymentVariables = Parameters<typeof collectFeePayment>[0] & { studentId?: string };

export function useCollectFeePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: CollectFeePaymentVariables) => {
      const { studentId: _s, ...payload } = variables;
      return collectFeePayment(payload);
    },
    onSettled: (_, __, variables) => {
      if (variables.studentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.clerk.studentLedger(variables.studentId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.clerk.feeAnalytics({}), exact: false });
    },
  });
}
