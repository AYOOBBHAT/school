import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useTeacherAttendanceAssignments,
  useStudentsForAttendance,
  useAttendanceForClass,
  useSubmitAttendance,
} from '../hooks/useAttendance';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useAuth } from '../../../navigation/AuthContext';
import { Attendance, Assignment, StudentForAttendance } from '../../../shared/types';
import type { TeacherStackScreenProps } from '../../../navigation/types';

type Props = TeacherStackScreenProps<'MarkAttendance'>;

export function MarkAttendanceScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { assignmentId, classGroupId, sectionId, date: routeDate } = route.params || {};
  const [selectedAssignment, setSelectedAssignment] = useState<MappedAssignment | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [date, setDate] = useState(routeDate || new Date().toISOString().split('T')[0]);

  const { data: assignmentsData, isLoading } = useTeacherAttendanceAssignments(user?.id || '');
  const currentDate = date || new Date().toISOString().split('T')[0];
  
  const { data: studentsData, isLoading: loadingStudents } = useStudentsForAttendance(
    selectedAssignment?.class_group_id || '',
    selectedAssignment?.section_id || undefined,
    currentDate,
    !!selectedAssignment
  );
  const { data: existingAttendanceData } = useAttendanceForClass(
    selectedAssignment?.class_group_id || '',
    currentDate,
    !!selectedAssignment
  );
  const submitAttendanceMutation = useSubmitAttendance();

  interface MappedAssignment {
    id: string;
    class_group_id: string;
    section_id: string | null | undefined;
    class_groups: { id: string; name: string } | null;
    sections: { id: string; name: string } | null;
    subjects: { name: string; code: string };
  }

  const assignments: MappedAssignment[] = (assignmentsData?.assignments || []).map((aa: Assignment) => ({
    id: aa.id,
    class_group_id: aa.class_group_id,
    section_id: aa.section_id,
    class_groups: aa.class_groups || { id: '', name: 'N/A' },
    sections: aa.sections || null,
    subjects: { name: 'Attendance', code: '' }
  }));

  const students = studentsData?.students || [];

  useEffect(() => {
    if (assignmentId && assignments.length > 0) {
      const found = assignments.find((a: MappedAssignment) => a.id === assignmentId || a.class_group_id === classGroupId);
      if (found) setSelectedAssignment(found);
    }
  }, [assignmentId, classGroupId, assignments]);

  useEffect(() => {
    if (studentsData?.isHoliday) {
      Alert.alert('Holiday', studentsData.message || 'Attendance cannot be marked on holidays');
      return;
    }
    
    if (students.length > 0) {
      const initialAttendance: Record<string, 'present' | 'absent' | 'late'> = {};
      students.forEach((student: StudentForAttendance) => {
        initialAttendance[student.id] = 'present';
      });
      setAttendance(initialAttendance);
    }
  }, [students]);

  useEffect(() => {
    if (existingAttendanceData?.attendance) {
      const records: Record<string, 'present' | 'absent' | 'late'> = {};
      existingAttendanceData.attendance.forEach((record: Attendance) => {
        const status = record.status;
        if (status === 'present' || status === 'absent' || status === 'late') {
          records[record.student_id] = status;
        } else {
          records[record.student_id] = 'present';
        }
      });
      setAttendance(prev => ({ ...prev, ...records }));
    }
  }, [existingAttendanceData]);

  const toggleAttendance = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = () => {
    if (!selectedAssignment || !user?.schoolId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    const attendanceData: Attendance[] = Object.entries(attendance).map(([studentId, status]) => ({
      student_id: studentId,
      class_group_id: selectedAssignment.class_group_id,
      date: currentDate,
      status: status,
      school_id: user.schoolId,
    }));

    submitAttendanceMutation.mutate(attendanceData, {
      onSuccess: () => {
        Alert.alert('Success', 'Attendance saved successfully');
        navigation.goBack();
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to save attendance';
        Alert.alert('Error', message);
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

  if (!selectedAssignment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Class for Attendance</Text>
        </View>
        <FlatList
          data={assignments}
          keyExtractor={item => item.id}
          contentContainerStyle={assignments.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="📅"
              title="No classes assigned"
              message="Contact principal to assign you attendance classes"
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.classCard}>
              <TouchableOpacity onPress={() => setSelectedAssignment(item)}>
                <Text style={styles.className}>{item.class_groups?.name || 'Unknown'}</Text>
                {item.sections && <Text style={styles.sectionName}>Section: {item.sections.name}</Text>}
              </TouchableOpacity>
            </Card>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => setSelectedAssignment(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>
          {selectedAssignment.class_groups?.name || 'Mark Attendance'}
          {selectedAssignment.sections && ` - ${selectedAssignment.sections.name}`}
        </Text>
        <TextInput
          style={styles.dateInput}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
        />
      </View>

      {loadingStudents ? (
        <LoadingSpinner message="Loading students..." />
      ) : (
        <ScrollView style={styles.content}>
          {students.length === 0 ? (
            <EmptyState icon="👥" title="No students found" message="This class has no students yet" />
          ) : (
            <>
              {/* Bulk Actions */}
              <View style={styles.bulkActions}>
                <TouchableOpacity
                  style={[styles.bulkButton, styles.markAllPresent]}
                  onPress={() => {
                    const allPresent: Record<string, 'present'> = {};
                    students.forEach((s) => {
                      allPresent[s.id] = 'present';
                    });
                    setAttendance(allPresent);
                  }}
                >
                  <Text style={styles.bulkButtonText}>✓ Mark All Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkButton, styles.markAllAbsent]}
                  onPress={() => {
                    const allAbsent: Record<string, 'absent'> = {};
                    students.forEach((s) => {
                      allAbsent[s.id] = 'absent';
                    });
                    setAttendance(allAbsent);
                  }}
                >
                  <Text style={styles.bulkButtonText}>✕ Mark All Absent</Text>
                </TouchableOpacity>
              </View>

              {/* Students List */}
              {students.map(student => (
                <Card key={student.id} style={styles.studentCard}>
                  <View style={styles.studentHeader}>
                    <Text style={styles.studentName}>{student.profile?.full_name || student.full_name || 'Unknown'}</Text>
                    {student.roll_number && <Text style={styles.rollNumber}>Roll: {student.roll_number}</Text>}
                  </View>
                  <View style={styles.attendanceButtons}>
                    <TouchableOpacity
                      style={[styles.attendanceButton, attendance[student.id] === 'present' && styles.selected]}
                      onPress={() => toggleAttendance(student.id, 'present')}
                    >
                      <Text style={[styles.buttonText, attendance[student.id] === 'present' && styles.selectedText]}>
                        Present
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.attendanceButton, attendance[student.id] === 'absent' && styles.selected]}
                      onPress={() => toggleAttendance(student.id, 'absent')}
                    >
                      <Text style={[styles.buttonText, attendance[student.id] === 'absent' && styles.selectedText]}>
                        Absent
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.attendanceButton, attendance[student.id] === 'late' && styles.selected]}
                      onPress={() => toggleAttendance(student.id, 'late')}
                    >
                      <Text style={[styles.buttonText, attendance[student.id] === 'late' && styles.selectedText]}>
                        Late
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {students.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={submitAttendance}>
            <Text style={styles.submitText}>Submit Attendance</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTop: { marginBottom: 8 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  backButtonText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  dateInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, backgroundColor: '#f8fafc', marginTop: 8 },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  classCard: { marginBottom: 12, padding: 16 },
  className: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sectionName: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  content: { flex: 1, padding: 16 },
  studentCard: { marginBottom: 12, padding: 16 },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },
  rollNumber: { fontSize: 12, color: '#64748b', marginLeft: 8 },
  attendanceButtons: { flexDirection: 'row', gap: 8 },
  attendanceButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  selected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  selectedText: { color: '#fff' },
  bulkActions: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  bulkButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  markAllPresent: { backgroundColor: '#10b981' },
  markAllAbsent: { backgroundColor: '#ef4444' },
  bulkButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  submitButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
