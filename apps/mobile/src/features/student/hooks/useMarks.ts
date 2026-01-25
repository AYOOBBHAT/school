import { useQuery } from '@tanstack/react-query';
import { loadMarks } from '../../../shared/services/student.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useStudentMarks(params?: {
  student_id?: string;
  subject_id?: string;
  exam_id?: string;
}) {
  return useQuery({
    queryKey: queryKeys.student.marks(params),
    queryFn: () => loadMarks(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
