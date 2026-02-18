import { useQuery } from '@tanstack/react-query';
import { loadSalaryPaymentHistory } from '../../../shared/services/teacher.service';

export function usePaymentHistory(teacherId: string, enabled: boolean, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['teacher', 'payment-history', teacherId, page, limit],
    queryFn: () => loadSalaryPaymentHistory(teacherId, { page, limit }),
    staleTime: 2 * 60 * 1000,
    enabled: !!teacherId && enabled,
  });
}
