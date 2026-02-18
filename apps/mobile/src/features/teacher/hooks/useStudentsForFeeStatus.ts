import { useQuery } from '@tanstack/react-query';
import { loadStudentsForFeeStatus } from '../../../shared/services/teacher.service';

export function useStudentsForFeeStatus() {
  return useQuery({
    queryKey: ['teacher', 'students-fee-status'],
    queryFn: loadStudentsForFeeStatus,
    staleTime: 2 * 60 * 1000,
  });
}
