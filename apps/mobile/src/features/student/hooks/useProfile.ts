import { useQuery } from '@tanstack/react-query';
import { loadProfile } from '../../../shared/services/student.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useStudentProfile() {
  return useQuery({
    queryKey: queryKeys.student.profile,
    queryFn: () => loadProfile(),
    staleTime: 10 * 60 * 1000, // 10 minutes - profile doesn't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}
