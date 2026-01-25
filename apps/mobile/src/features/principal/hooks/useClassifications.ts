import { useQuery } from '@tanstack/react-query';
import { loadClassificationTypes } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useClassifications() {
  return useQuery({
    queryKey: queryKeys.principal.classifications,
    queryFn: loadClassificationTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
