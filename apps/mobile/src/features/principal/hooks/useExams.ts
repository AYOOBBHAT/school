import { useQuery } from '@tanstack/react-query';
import { loadExams } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useExams() {
  return useQuery({
    queryKey: queryKeys.principal.exams,
    queryFn: loadExams,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
