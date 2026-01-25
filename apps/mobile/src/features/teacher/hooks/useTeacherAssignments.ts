import { useQuery } from '@tanstack/react-query';
import { loadTeacherAssignments } from '../../../shared/services/teacher.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useTeacherAssignments(teacherId: string) {
  return useQuery({
    queryKey: queryKeys.teacher.assignments(teacherId),
    queryFn: () => loadTeacherAssignments(teacherId),
    enabled: !!teacherId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
