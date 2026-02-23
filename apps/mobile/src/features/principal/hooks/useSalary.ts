import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadSalarySummary,
  loadSalaryStructures,
  loadSalaryRecords,
  createSalaryStructure,
} from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useSalarySummary() {
  return useQuery({
    queryKey: queryKeys.principal.salary.summary,
    queryFn: loadSalarySummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

export function useSalaryStructures() {
  return useQuery({
    queryKey: queryKeys.principal.salary.structures,
    queryFn: loadSalaryStructures,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useSalaryRecords() {
  return useQuery({
    queryKey: queryKeys.principal.salary.records,
    queryFn: loadSalaryRecords,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createSalaryStructure>[0]) => createSalaryStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.salary.structures });
      queryClient.invalidateQueries({ queryKey: queryKeys.principal.salary.summary });
    },
  });
}
