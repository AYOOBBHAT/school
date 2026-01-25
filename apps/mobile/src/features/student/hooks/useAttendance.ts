import { useQuery } from '@tanstack/react-query';
import { loadAttendance } from '../../../shared/services/student.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useStudentAttendance(params?: {
  student_id?: string;
  class_group_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: queryKeys.student.attendance(params),
    queryFn: () => loadAttendance(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
