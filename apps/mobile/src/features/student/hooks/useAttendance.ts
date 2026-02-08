import { useQuery } from '@tanstack/react-query';
import { loadAttendance } from '../../../shared/services/student.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useStudentAttendance() {
  return useQuery({
    queryKey: queryKeys.student.attendance(),
    queryFn: () => loadAttendance(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
