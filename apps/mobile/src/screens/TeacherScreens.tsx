import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

interface AttendanceRecord {
  id: string;
  student_name: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

interface MarkRecord {
  id: string;
  student_name: string;
  exam_name: string;
  subject: string;
  marks_obtained: number;
  total_marks: number;
}

export function MarkAttendanceScreen({ navigation, route }: any) {
  const { classId, className } = route?.params || {};
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadStudents();
  }, [classId]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call to fetch students
      // const data = await api.getStudentsByClass(classId);
      // setStudents(data);
      setStudents([]);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = async () => {
    try {
      // TODO: Implement API call to submit attendance
      // await api.submitAttendance({ classId, date, attendance });
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting attendance:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading students..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{className || 'Mark Attendance'}</Text>
        <Text style={styles.date}>{new Date(date).toLocaleDateString()}</Text>
      </View>

      <ScrollView style={styles.content}>
        {students.length === 0 ? (
          <EmptyState icon="👥" title="No students found" message="This class has no students yet" />
        ) : (
          students.map(student => (
            <Card key={student.id} style={styles.studentCard}>
              <Text style={styles.studentName}>{student.full_name}</Text>
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
          ))
        )}
      </ScrollView>

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

export function EnterMarksScreen({ navigation, route }: any) {
  const { examId, examName, classId } = route?.params || {};
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { marks: string; total: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, [classId]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call
      setStudents([]);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMarks = (studentId: string, field: 'marks' | 'total', value: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const submitMarks = async () => {
    try {
      // TODO: Implement API call
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting marks:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading students..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{examName || 'Enter Marks'}</Text>
      </View>

      <ScrollView style={styles.content}>
        {students.length === 0 ? (
          <EmptyState icon="📝" title="No students found" />
        ) : (
          students.map(student => (
            <Card key={student.id} style={styles.studentCard}>
              <Text style={styles.studentName}>{student.full_name}</Text>
              <View style={styles.marksInput}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Marks Obtained</Text>
                  <View style={styles.input}>
                    <Text style={styles.inputText}>
                      {marks[student.id]?.marks || '0'}
                    </Text>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Total Marks</Text>
                  <View style={styles.input}>
                    <Text style={styles.inputText}>
                      {marks[student.id]?.total || '100'}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {students.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={submitMarks}>
            <Text style={styles.submitText}>Submit Marks</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  date: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  studentCard: {
    marginBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  attendanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  selected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  selectedText: {
    color: '#fff',
  },
  marksInput: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputText: {
    fontSize: 16,
    color: '#1e293b',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
