import { useQuery } from '@tanstack/react-query';
import { loadTeacherSalary } from '../../../shared/services/teacher.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useTeacherSalary() {
  return useQuery({
    queryKey: queryKeys.teacher.salary,
    queryFn: loadTeacherSalary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
