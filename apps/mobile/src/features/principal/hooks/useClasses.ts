import { useQuery } from '@tanstack/react-query';
import { loadClasses } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useClasses() {
  return useQuery({
    queryKey: queryKeys.principal.classes,
    queryFn: loadClasses,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}
