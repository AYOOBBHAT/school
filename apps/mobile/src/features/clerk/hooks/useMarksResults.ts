import { useQuery } from '@tanstack/react-query';
import {
  loadExams,
  loadMarksResults,
} from '../../../shared/services/clerk.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useClerkExams() {
  return useQuery({
    queryKey: queryKeys.clerk.exams,
    queryFn: loadExams,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useMarksResults(
  params: {
    class_group_id?: string;
    exam_id?: string;
  },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.clerk.marksResults(params),
    queryFn: () => loadMarksResults(params),
    enabled: enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - marks results may change
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}
