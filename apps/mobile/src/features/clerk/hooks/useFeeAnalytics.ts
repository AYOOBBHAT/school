import { useQuery } from '@tanstack/react-query';
import {
  loadUnpaidFeeAnalytics,
} from '../../../shared/services/clerk.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useUnpaidFeeAnalytics(params: {
  class_group_id?: string;
  time_scope?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.clerk.feeAnalytics(params),
    queryFn: () => loadUnpaidFeeAnalytics(params),
    staleTime: 2 * 60 * 1000, // 2 minutes - analytics data changes with payments
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
