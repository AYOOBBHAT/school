import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadClassificationTypes,
  loadClassificationValues,
  createClassificationType,
  createClassificationValue,
  deleteClassificationType,
  deleteClassificationValue,
} from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';

export function useClassifications() {
  return useQuery({
    queryKey: queryKeys.principal.classifications,
    queryFn: loadClassificationTypes,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
}

export function useClassificationValues(typeId: string | null) {
  return useQuery({
    queryKey: queryKeys.principal.classificationValues(typeId ?? ''),
    queryFn: () => loadClassificationValues(typeId!),
    enabled: !!typeId,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useCreateClassificationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => createClassificationType(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.principal.classifications }),
  });
}

export function useCreateClassificationValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { classification_type_id: string; value: string }) =>
      createClassificationValue(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.principal.classifications });
      qc.invalidateQueries({
        queryKey: queryKeys.principal.classificationValues(variables.classification_type_id),
      });
    },
  });
}

export function useDeleteClassificationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (typeId: string) => deleteClassificationType(typeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.principal.classifications }),
  });
}

export function useDeleteClassificationValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ valueId }: { valueId: string; typeId: string }) =>
      deleteClassificationValue(valueId),
    onSuccess: (_, { typeId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.principal.classifications });
      qc.invalidateQueries({
        queryKey: queryKeys.principal.classificationValues(typeId),
      });
    },
  });
}
