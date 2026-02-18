import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExams, useStudentsForMarks, useSubmitMarks } from '../hooks/useMarks';
import { useTeacherAssignments } from '../hooks/useTeacherAssignments';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useAuth } from '../../../navigation/AuthContext';
import { Assignment, StudentForMarks } from '../../../shared/types';
import type { TeacherStackScreenProps } from '../../../navigation/types';

type Props = TeacherStackScreenProps<'EnterMarks'>;

export function EnterMarksScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { classGroupId, subjectId } = route.params || {};
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>(classGroupId || '');
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectId || '');
  const [marks, setMarks] = useState<Record<string, { marks_obtained: string; max_marks: string }>>({});

  useEffect(() => {
    if (classGroupId) setSelectedClass(classGroupId);
    if (subjectId) setSelectedSubject(subjectId);
  }, [classGroupId, subjectId]);

  const { data: examsData } = useExams();
  const { data: assignmentsData, isLoading } = useTeacherAssignments(user?.id || '');
  const { data: studentsData, isLoading: loadingStudents } = useStudentsForMarks(
    selectedClass,
    !!selectedClass
  );
  const submitMarksMutation = useSubmitMarks();

  const exams = examsData?.exams || [];
  const assignments = assignmentsData?.assignments || [];

  const classes = useMemo(() => {
    const uniqueClasses = new Map();
    assignments.forEach((assignment: Assignment) => {
      if (!uniqueClasses.has(assignment.class_group_id)) {
        uniqueClasses.set(assignment.class_group_id, {
          id: assignment.class_group_id,
          name: assignment.class_groups?.name || 'Unknown'
        });
      }
    });
    return Array.from(uniqueClasses.values());
  }, [assignments]);

  const subjects = useMemo(() => {
    if (!selectedClass) return [];
    const uniqueSubjects = new Map();
    assignments
      .filter((a: Assignment) => a.class_group_id === selectedClass)
      .forEach((assignment: Assignment) => {
        if (!uniqueSubjects.has(assignment.subject_id)) {
          uniqueSubjects.set(assignment.subject_id, {
            id: assignment.subject_id,
            name: assignment.subjects?.name || 'Unknown',
            code: assignment.subjects?.code
          });
        }
      });
    return Array.from(uniqueSubjects.values());
  }, [assignments, selectedClass]);

  const students = studentsData?.students || [];

  const updateMarks = (studentId: string, field: 'marks_obtained' | 'max_marks', value: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
        marks_obtained: prev[studentId]?.marks_obtained ?? '',
        max_marks: prev[studentId]?.max_marks ?? '100',
      },
    }));
  };

  const resetForm = () => {
    setSelectedExam('');
    setSelectedClass(classGroupId || '');
    setSelectedSubject(subjectId || '');
    setMarks({});
  };

  const submitMarks = () => {
    if (!selectedExam || !selectedClass || !selectedSubject || !user?.schoolId) {
      Alert.alert('Validation Error', 'Please select Exam, Class, and Subject');
      return;
    }
    // Same as web: filter entries with both marks_obtained and max_marks
    const marksArray = Object.entries(marks)
      .filter(([_, data]) => data.marks_obtained && data.max_marks)
      .map(([studentId, data]) => ({
        student_id: studentId,
        exam_id: selectedExam,
        subject_id: selectedSubject,
        marks_obtained: parseFloat(data.marks_obtained),
        max_marks: parseFloat(data.max_marks),
        school_id: user.schoolId,
      }));

    if (marksArray.length === 0) {
      Alert.alert('Validation Error', 'Please enter at least one mark');
      return;
    }

    submitMarksMutation.mutate(marksArray, {
      onSuccess: () => {
        Alert.alert('Success', 'Marks saved successfully!');
        setMarks({});
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to submit marks';
        Alert.alert('Error', message);
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

  const selectedExamName = exams.find((e) => e.id === selectedExam)?.name ?? '';
  const selectedClassName = classes.find((c) => c.id === selectedClass)?.name ?? '';
  const selectedSubjectName = subjects.find((s) => s.id === selectedSubject)?.name ?? '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Enter Marks</Text>
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Select Exam *</Text>
        <View style={styles.pickerContainer}>
          {exams.map(exam => (
            <TouchableOpacity
              key={exam.id}
              style={[styles.pickerItem, selectedExam === exam.id && styles.pickerItemSelected]}
              onPress={() => {
                setSelectedExam(exam.id);
                setSelectedClass('');
                setSelectedSubject('');
                setMarks({});
              }}
            >
              <Text style={selectedExam === exam.id ? styles.pickerItemTextSelected : styles.pickerItemText}>
                {exam.name} {exam.term && `(${exam.term})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedExam && (
          <>
            <Text style={styles.filterLabel}>Select Class *</Text>
            <View style={styles.pickerContainer}>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.pickerItem, selectedClass === cls.id && styles.pickerItemSelected]}
                  onPress={() => {
                    setSelectedClass(cls.id);
                    setSelectedSubject('');
                    setMarks({});
                  }}
                >
                  <Text style={selectedClass === cls.id ? styles.pickerItemTextSelected : styles.pickerItemText}>
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {selectedClass && (
          <>
            <Text style={styles.filterLabel}>Select Subject *</Text>
            <View style={styles.pickerContainer}>
              {subjects.map(subject => (
                <TouchableOpacity
                  key={subject.id}
                  style={[styles.pickerItem, selectedSubject === subject.id && styles.pickerItemSelected]}
                  onPress={() => setSelectedSubject(subject.id)}
                >
                  <Text style={selectedSubject === subject.id ? styles.pickerItemTextSelected : styles.pickerItemText}>
                    {subject.name} {subject.code && `(${subject.code})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {loadingStudents ? (
        <LoadingSpinner message="Loading students..." />
      ) : (
        <ScrollView style={styles.content}>
          {selectedExam && selectedClass && selectedSubject && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Enter Marks for Students</Text>
              <Text style={styles.sectionSubtext}>
                {selectedExamName} - {selectedClassName} - {selectedSubjectName}
              </Text>
            </View>
          )}
          {students.length === 0 && selectedExam && selectedClass && selectedSubject ? (
            <EmptyState icon="👥" title="No students found" message="No students found in this class." />
          ) : selectedExam && selectedClass && selectedSubject ? (
            students.map(student => (
              <Card key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <Text style={styles.rollNumber}>{student.roll_number ?? 'N/A'}</Text>
                  <Text style={styles.studentName}>{student.profile?.full_name ?? student.full_name ?? 'N/A'}</Text>
                </View>
                <View style={styles.marksInput}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Marks Obtained</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={marks[student.id]?.marks_obtained ?? ''}
                      onChangeText={(text) => updateMarks(student.id, 'marks_obtained', text)}
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Max Marks</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={marks[student.id]?.max_marks ?? '100'}
                      onChangeText={(text) => updateMarks(student.id, 'max_marks', text)}
                      placeholder="100"
                    />
                  </View>
                </View>
              </Card>
            ))
          ) : null}
        </ScrollView>
      )}

      {selectedExam && selectedClass && selectedSubject && (
        <View style={styles.footer}>
          {students.length > 0 && (
            <TouchableOpacity style={styles.submitButton} onPress={submitMarks}>
              <Text style={styles.submitText}>Submit Marks</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.resetButton} onPress={resetForm}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  filters: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 8 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 8, marginBottom: 8 },
  pickerItemSelected: { backgroundColor: '#2563eb' },
  pickerItemText: { fontSize: 14, color: '#64748b' },
  pickerItemTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  sectionCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  sectionSubtext: { fontSize: 14, color: '#64748b' },
  studentCard: { marginBottom: 12, padding: 16 },
  studentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  rollNumber: { fontSize: 14, color: '#64748b', minWidth: 48 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },
  marksInput: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 12 },
  submitButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resetButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  resetText: { fontSize: 16, color: '#64748b' },
});
