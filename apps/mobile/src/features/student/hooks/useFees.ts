import { useQuery } from '@tanstack/react-query';
import { loadFees } from '../../../shared/services/student.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useStudentFees(params?: {
  student_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: queryKeys.student.fees(params),
    queryFn: () => loadFees(params),
    staleTime: 2 * 60 * 1000, // 2 minutes - fee data changes with payments
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
