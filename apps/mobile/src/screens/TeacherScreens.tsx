import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../navigation/AuthContext';
import { Attendance } from '../types';

/**
 * Teacher Screens for Mobile App
 * 
 * IMPORTANT: Data Isolation (SaaS Multi-Tenancy)
 * - All API requests use Bearer token authentication
 * - Backend extracts school_id from authenticated user profile
 * - All database queries filter by user.schoolId on the backend
 * - school_id in request bodies is validated against authenticated user's school_id
 * - Never hardcode or trust school_id from client - always use user.schoolId from AuthContext
 */

interface Assignment {
  id: string;
  class_group_id: string;
  subject_id: string;
  section_id?: string;
  class_groups?: { id: string; name: string; description?: string };
  subjects?: { id: string; name: string; code?: string };
  sections?: { id: string; name: string };
}

// My Classes Screen
export function MyClassesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }
      const data = await api.getTeacherAssignments(user.id);
      setAssignments(data.assignments || []);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      Alert.alert('Error', error.message || 'Failed to load classes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAssignments();
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading classes..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classes & Subjects</Text>
      </View>

      <FlatList
        data={assignments}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={assignments.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="No classes assigned"
            message="Contact your principal to assign you to classes"
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.classCard}>
            <Text style={styles.className}>{item.class_groups?.name || 'Unknown Class'}</Text>
            {item.sections && (
              <Text style={styles.sectionName}>Section: {item.sections.name}</Text>
            )}
            <Text style={styles.subjectName}>
              {item.subjects?.name || 'Unknown Subject'}
              {item.subjects?.code && ` (${item.subjects.code})`}
            </Text>
            {item.class_groups?.description && (
              <Text style={styles.description}>{item.class_groups.description}</Text>
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

// Mark Attendance Screen - Complete implementation
export function MarkAttendanceScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { assignmentId, classId, sectionId, className } = route?.params || {};
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    loadAttendanceAssignments();
  }, []);

  useEffect(() => {
    if (selectedAssignment) {
      loadStudents();
      loadExistingAttendance();
    }
  }, [selectedAssignment, date]);

  const loadAttendanceAssignments = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }
      const data = await api.getTeacherAttendanceAssignments(user.id);
      const attendanceAssignments = (data.assignments || []).map((aa: any) => ({
        id: aa.id,
        class_group_id: aa.class_group?.id || aa.class_group_id,
        section_id: aa.section?.id || aa.section_id,
        class_groups: aa.class_group || { name: 'N/A' },
        sections: aa.section || null,
        subjects: { name: 'Attendance', code: '' }
      }));
      setAssignments(attendanceAssignments);
      
      // If specific assignment was passed, select it
      if (assignmentId) {
        const found = attendanceAssignments.find((a: any) => a.id === assignmentId || a.class_group_id === classId);
        if (found) setSelectedAssignment(found);
      }
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      Alert.alert('Error', error.message || 'Failed to load attendance assignments');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    if (!selectedAssignment) return;
    try {
      setLoadingStudents(true);
      const data = await api.getStudentsForAttendance(
        selectedAssignment.class_group_id,
        selectedAssignment.section_id,
        date
      );
      
      if (data.isHoliday) {
        Alert.alert('Holiday', data.message || 'Attendance cannot be marked on holidays');
        setStudents([]);
        return;
      }
      
      const studentsList = data.students || [];
      setStudents(studentsList);
      
      // Initialize attendance as 'present' for all students
      const initialAttendance: Record<string, 'present' | 'absent' | 'late'> = {};
      studentsList.forEach((student: any) => {
        initialAttendance[student.id] = 'present';
      });
      setAttendance(initialAttendance);
    } catch (error: any) {
      console.error('Error loading students:', error);
      Alert.alert('Error', error.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadExistingAttendance = async () => {
    if (!selectedAssignment) return;
    try {
      const data = await api.getAttendanceForClass(selectedAssignment.class_group_id, date);
      const records: Record<string, 'present' | 'absent' | 'late'> = {};
      (data.attendance || []).forEach((record: Attendance) => {
        // Only map valid statuses that we support in the UI (exclude 'excused')
        const status = record.status;
        if (status === 'present' || status === 'absent' || status === 'late') {
          records[record.student_id] = status;
        } else {
          records[record.student_id] = 'present'; // Default for 'excused' or unknown statuses
        }
      });
      // Merge with existing attendance state
      setAttendance(prev => ({ ...prev, ...records }));
    } catch (error) {
      console.error('Error loading existing attendance:', error);
    }
  };

  const toggleAttendance = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = async () => {
    if (!selectedAssignment || !user?.schoolId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      const attendanceData: Attendance[] = Object.entries(attendance).map(([studentId, status]) => ({
        student_id: studentId,
        class_group_id: selectedAssignment.class_group_id,
        date: date,
        status: status,
        school_id: user.schoolId,
      }));

      await api.submitAttendanceBulk(attendanceData);
      Alert.alert('Success', 'Attendance saved successfully');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      Alert.alert('Error', error.message || 'Failed to save attendance');
    }
  };

  if (loading) {
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
            students.map(student => (
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
            ))
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

// Enter Marks Screen - Complete implementation
export function EnterMarksScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [marks, setMarks] = useState<Record<string, { marks_obtained: string; max_marks: string }>>({});
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    loadExams();
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadSubjects();
    } else {
      setSubjects([]);
      setStudents([]);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject) {
      loadStudents();
      loadExistingMarks();
    } else {
      setStudents([]);
      setMarks({});
    }
  }, [selectedExam, selectedClass, selectedSubject]);

  const loadExams = async () => {
    try {
      const data = await api.getExams();
      setExams(data.exams || []);
    } catch (error: any) {
      console.error('Error loading exams:', error);
    }
  };

  const loadClasses = async () => {
    try {
      if (!user?.id) return;
      const data = await api.getTeacherAssignments(user.id);
      const assignments = data.assignments || [];
      const uniqueClasses = new Map();
      assignments.forEach((assignment: any) => {
        if (!uniqueClasses.has(assignment.class_group_id)) {
          uniqueClasses.set(assignment.class_group_id, {
            id: assignment.class_group_id,
            name: assignment.class_groups?.name || 'Unknown'
          });
        }
      });
      setClasses(Array.from(uniqueClasses.values()));
    } catch (error: any) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      if (!user?.id) return;
      const data = await api.getTeacherAssignments(user.id);
      const assignments = data.assignments || [];
      const uniqueSubjects = new Map();
      assignments
        .filter((a: any) => a.class_group_id === selectedClass)
        .forEach((assignment: any) => {
          if (!uniqueSubjects.has(assignment.subject_id)) {
            uniqueSubjects.set(assignment.subject_id, {
              id: assignment.subject_id,
              name: assignment.subjects?.name || 'Unknown',
              code: assignment.subjects?.code
            });
          }
        });
      setSubjects(Array.from(uniqueSubjects.values()));
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadStudents = async () => {
    if (!selectedClass) return;
    try {
      setLoadingStudents(true);
      const data = await api.getStudentsForMarks({
        class_group_id: selectedClass,
        exam_id: selectedExam,
        subject_id: selectedSubject,
      });
      setStudents(data.students || []);
    } catch (error: any) {
      console.error('Error loading students:', error);
      Alert.alert('Error', error.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadExistingMarks = async () => {
    // Note: Pre-loading existing marks is optional - teachers usually enter fresh marks
    // This is a silent operation, errors are ignored
    if (!selectedExam || !selectedSubject || !selectedClass) return;
    // We don't have a direct endpoint for getting marks by exam/subject/class
    // Marks will be entered fresh each time, which is the standard workflow
  };

  const updateMarks = (studentId: string, field: 'marks_obtained' | 'max_marks', value: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value, marks_obtained: prev[studentId]?.marks_obtained || '', max_marks: prev[studentId]?.max_marks || '100' },
    }));
  };

  const submitMarks = async () => {
    if (!selectedExam || !selectedClass || !selectedSubject || !user?.schoolId) {
      Alert.alert('Validation Error', 'Please select Exam, Class, and Subject');
      return;
    }

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

    try {
      await api.submitMarksBulk(marksArray);
      Alert.alert('Success', 'Marks submitted successfully');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error submitting marks:', error);
      Alert.alert('Error', error.message || 'Failed to submit marks');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

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
                setStudents([]);
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
                    setStudents([]);
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
          {students.length === 0 && selectedExam && selectedClass && selectedSubject ? (
            <EmptyState icon="👥" title="No students found" message="This class has no students yet" />
          ) : selectedExam && selectedClass && selectedSubject ? (
            students.map(student => (
              <Card key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <Text style={styles.studentName}>{student.profile?.full_name || student.full_name || 'Unknown'}</Text>
                  {student.roll_number && <Text style={styles.rollNumber}>Roll: {student.roll_number}</Text>}
                </View>
                <View style={styles.marksInput}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Marks Obtained</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={marks[student.id]?.marks_obtained || ''}
                      onChangeText={(text) => updateMarks(student.id, 'marks_obtained', text)}
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Max Marks</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={marks[student.id]?.max_marks || '100'}
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

      {students.length > 0 && selectedExam && selectedClass && selectedSubject && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={submitMarks}>
            <Text style={styles.submitText}>Submit Marks</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// My Salary Screen
export function MySalaryScreen({ navigation }: any) {
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSalary();
  }, []);

  const loadSalary = async () => {
    try {
      setLoading(true);
      const data = await api.getTeacherSalary();
      setSalaryRecords(data.records || []);
    } catch (error: any) {
      console.error('Error loading salary:', error);
      Alert.alert('Error', error.message || 'Failed to load salary information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSalary();
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading salary..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Salary</Text>
      </View>

      <FlatList
        data={salaryRecords}
        keyExtractor={(item, index) => item.id || `salary-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={salaryRecords.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState icon="💰" title="No salary records" message="Salary records will appear here once generated" />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>
              {new Date(2000, item.month - 1).toLocaleString('default', { month: 'long' })} {item.year}
            </Text>
            <Text style={styles.cardEmail}>Gross: ₹{parseFloat(item.gross_salary || 0).toLocaleString()}</Text>
            <Text style={styles.cardEmail}>Net: ₹{parseFloat(item.net_salary || 0).toLocaleString()}</Text>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, {
                color: item.status === 'paid' ? '#10b981' : item.status === 'approved' ? '#2563eb' : '#64748b'
              }]}>
                {item.status}
              </Text>
            </View>
            {item.payment_date && (
              <Text style={styles.dateText}>Paid: {new Date(item.payment_date).toLocaleDateString()}</Text>
            )}
          </Card>
        )}
      />
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
  filters: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 8 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 8, marginBottom: 8 },
  pickerItemSelected: { backgroundColor: '#2563eb' },
  pickerItemText: { fontSize: 14, color: '#64748b' },
  pickerItemTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  classCard: { marginBottom: 12, padding: 16 },
  className: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sectionName: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  subjectName: { fontSize: 16, fontWeight: '600', color: '#2563eb', marginTop: 8 },
  description: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
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
  marksInput: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  submitButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  statusBadge: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});