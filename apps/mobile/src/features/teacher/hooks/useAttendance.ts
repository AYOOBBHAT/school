import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loadTeacherAttendanceAssignments,
  loadStudentsForAttendance,
  loadAttendanceForClass,
  submitAttendanceBulk,
} from '../../../shared/services/teacher.service';
import { queryKeys } from '../../../shared/queryKeys';
import { Attendance } from '../../../shared/types';

export function useTeacherAttendanceAssignments(teacherId: string) {
  return useQuery({
    queryKey: queryKeys.teacher.attendanceAssignments(teacherId),
    queryFn: () => loadTeacherAttendanceAssignments(teacherId),
    enabled: !!teacherId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useStudentsForAttendance(
  classGroupId: string,
  sectionId: string | undefined,
  date: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.teacher.studentsForAttendance(classGroupId, sectionId, date),
    queryFn: () => loadStudentsForAttendance(classGroupId, sectionId, date),
    enabled: enabled && !!classGroupId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes - attendance data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useAttendanceForClass(classGroupId: string, date: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.teacher.attendanceForClass(classGroupId, date),
    queryFn: () => loadAttendanceForClass(classGroupId, date),
    enabled: enabled && !!classGroupId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes - attendance data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useSubmitAttendance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: submitAttendanceBulk,
    onMutate: async (newAttendance) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.teacher.attendance });

      // Optimistically update attendance for the specific class/date
      const classGroupId = newAttendance[0]?.class_group_id;
      const date = newAttendance[0]?.date;
      if (classGroupId && date) {
        const previous = queryClient.getQueryData<{ attendance: Attendance[] }>(
          queryKeys.teacher.attendanceForClass(classGroupId, date)
        );

        queryClient.setQueryData<{ attendance: Attendance[] }>(
          queryKeys.teacher.attendanceForClass(classGroupId, date),
          () => ({ attendance: newAttendance })
        );

        return { previous, classGroupId, date };
      }
      return {};
    },
    onError: (_err, _newAttendance, context) => {
      // Rollback on error
      if (context?.previous && context?.classGroupId && context?.date) {
        queryClient.setQueryData(
          queryKeys.teacher.attendanceForClass(context.classGroupId, context.date),
          context.previous
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate only the specific class/date attendance query
      const classGroupId = variables[0]?.class_group_id;
      const date = variables[0]?.date;
      if (classGroupId && date) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.teacher.attendanceForClass(classGroupId, date),
        });
      }
    },
  });
}
