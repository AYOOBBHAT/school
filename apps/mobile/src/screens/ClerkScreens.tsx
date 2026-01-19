import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Student, ClassGroup } from '../types';

// Fee Collection Screen
export function FeeCollectionScreen({ navigation }: any) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [monthlyLedger, setMonthlyLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash' as 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer',
    transaction_id: '',
    notes: '',
  });

  useEffect(() => {
    loadClasses();
    loadStudents();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (selectedStudent) {
      loadMonthlyLedger();
    }
  }, [selectedStudent]);

  const loadClasses = async () => {
    try {
      const data = await api.getClasses();
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await api.getStudents();
      let filtered = data.students || [];
      if (selectedClass) {
        filtered = filtered.filter(s => s.class_group_id === selectedClass);
      }
      setStudents(filtered);
    } catch (error: any) {
      console.error('Error loading students:', error);
      Alert.alert('Error', error.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyLedger = async () => {
    if (!selectedStudent) return;
    try {
      setLoadingLedger(true);
      const data = await api.getStudentMonthlyLedger(selectedStudent.id);
      setMonthlyLedger(data.ledger || []);
    } catch (error: any) {
      console.error('Error loading ledger:', error);
      Alert.alert('Error', error.message || 'Failed to load fee ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleCollectPayment = async () => {
    if (selectedComponents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one fee component');
      return;
    }
    if (!paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }

    try {
      await api.collectFeePayment({
        monthly_fee_component_ids: selectedComponents,
        payment_amount: parseFloat(paymentForm.payment_amount),
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        transaction_id: paymentForm.transaction_id || undefined,
        notes: paymentForm.notes || undefined,
      });
      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentModal(false);
      setSelectedComponents([]);
      setPaymentForm({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'cash',
        transaction_id: '',
        notes: '',
      });
      loadMonthlyLedger();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record payment');
    }
  };

  const toggleComponentSelection = (componentId: string) => {
    setSelectedComponents(prev =>
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

  const totalPending = monthlyLedger
    .flatMap(month => month.components || [])
    .filter((comp: any) => selectedComponents.includes(comp.id))
    .reduce((sum: number, comp: any) => sum + (comp.pending_amount || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fee Collection</Text>
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Filter by Class:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classFilter}>
          <TouchableOpacity
            style={[styles.classChip, !selectedClass && styles.classChipActive]}
            onPress={() => setSelectedClass('')}
          >
            <Text style={[styles.classChipText, !selectedClass && styles.classChipTextActive]}>All</Text>
          </TouchableOpacity>
          {classes.map(cls => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.classChip, selectedClass === cls.id && styles.classChipActive]}
              onPress={() => setSelectedClass(cls.id)}
            >
              <Text style={[styles.classChipText, selectedClass === cls.id && styles.classChipTextActive]}>
                {cls.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadStudents} />}
        contentContainerStyle={students.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="👥" title="No students found" message="Select a class to filter" />}
        renderItem={({ item }) => (
          <Card style={styles.studentCard}>
            <TouchableOpacity onPress={() => setSelectedStudent(item)}>
              <Text style={styles.studentName}>{item.profiles?.full_name || 'Unknown'}</Text>
              <Text style={styles.studentEmail}>Roll No: {item.roll_number}</Text>
              {item.class_groups && <Text style={styles.className}>Class: {item.class_groups.name}</Text>}
            </TouchableOpacity>
          </Card>
        )}
      />

      {/* Student Fee Details Modal */}
      {selectedStudent && (
        <Modal visible={!!selectedStudent} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedStudent.profiles?.full_name}</Text>
                <TouchableOpacity onPress={() => {
                  setSelectedStudent(null);
                  setSelectedComponents([]);
                }}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingLedger ? (
                <LoadingSpinner message="Loading fee details..." />
              ) : (
                <ScrollView style={styles.ledgerContainer}>
                  {monthlyLedger.map((month: any, idx: number) => (
                    <View key={idx} style={styles.monthSection}>
                      <Text style={styles.monthTitle}>{month.month_label}</Text>
                      {(month.components || []).map((comp: any) => (
                        <TouchableOpacity
                          key={comp.id}
                          style={[
                            styles.componentCard,
                            selectedComponents.includes(comp.id) && styles.componentCardSelected
                          ]}
                          onPress={() => toggleComponentSelection(comp.id)}
                        >
                          <Text style={styles.componentName}>{comp.fee_name}</Text>
                          <Text style={styles.componentAmount}>₹{comp.pending_amount || 0}</Text>
                          {selectedComponents.includes(comp.id) && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  {monthlyLedger.length === 0 && (
                    <EmptyState icon="💵" title="No fees found" message="This student has no pending fees" />
                  )}
                </ScrollView>
              )}

              {selectedComponents.length > 0 && (
                <TouchableOpacity
                  style={styles.collectButton}
                  onPress={() => {
                    setPaymentForm(prev => ({ ...prev, payment_amount: totalPending.toFixed(2) }));
                    setShowPaymentModal(true);
                  }}
                >
                  <Text style={styles.collectButtonText}>
                    Collect ₹{totalPending.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <TextInput
              style={styles.input}
              placeholder="Payment Amount *"
              keyboardType="decimal-pad"
              value={paymentForm.payment_amount}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, payment_amount: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Payment Date"
              value={paymentForm.payment_date}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, payment_date: text })}
            />
            <View style={styles.pickerRow}>
              <Text style={styles.label}>Payment Mode:</Text>
              <ScrollView horizontal style={styles.pickerRow}>
                {['cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer'].map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.pickerItem,
                      paymentForm.payment_mode === mode && styles.pickerItemSelected
                    ]}
                    onPress={() => setPaymentForm({ ...paymentForm, payment_mode: mode as any })}
                  >
                    <Text style={paymentForm.payment_mode === mode ? styles.pickerItemTextSelected : styles.pickerItemText}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Transaction ID (Optional)"
              value={paymentForm.transaction_id}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, transaction_id: text })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes (Optional)"
              multiline
              numberOfLines={3}
              value={paymentForm.notes}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, notes: text })}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleCollectPayment}>
                <Text style={styles.submitButtonText}>Record Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Salary Payment Screen
export function SalaryPaymentScreen({ navigation }: any) {
  const [unpaidTeachers, setUnpaidTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_mode: 'bank' as 'bank' | 'cash' | 'upi',
    payment_proof: '',
    notes: '',
    salary_month: new Date().getMonth() + 1,
    salary_year: new Date().getFullYear(),
    payment_type: 'salary' as 'salary' | 'advance' | 'adjustment' | 'bonus' | 'loan' | 'other',
  });

  useEffect(() => {
    loadUnpaidSalaries();
  }, []);

  const loadUnpaidSalaries = async () => {
    try {
      setLoading(true);
      const data = await api.getUnpaidSalaries('last_12_months');
      setUnpaidTeachers(data.teachers || []);
    } catch (error: any) {
      console.error('Error loading unpaid salaries:', error);
      Alert.alert('Error', error.message || 'Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedTeacher) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }

    try {
      const result = await api.recordSalaryPayment({
        teacher_id: selectedTeacher.teacher_id,
        payment_date: paymentForm.payment_date,
        amount: parseFloat(paymentForm.amount),
        payment_mode: paymentForm.payment_mode,
        payment_proof: paymentForm.payment_proof || undefined,
        notes: paymentForm.notes || undefined,
        salary_month: paymentForm.salary_month,
        salary_year: paymentForm.salary_year,
        payment_type: paymentForm.payment_type,
      });
      
      let message = 'Payment recorded successfully!';
      if (result.excess_amount && result.excess_amount > 0) {
        message += `\nExcess amount: ₹${result.excess_amount.toFixed(2)} applied as credit.`;
      }
      Alert.alert('Success', message);
      
      setShowPaymentModal(false);
      setSelectedTeacher(null);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_mode: 'bank',
        payment_proof: '',
        notes: '',
        salary_month: new Date().getMonth() + 1,
        salary_year: new Date().getFullYear(),
        payment_type: 'salary',
      });
      loadUnpaidSalaries();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record payment');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading salary data..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pay Salary</Text>
      </View>

      <FlatList
        data={unpaidTeachers}
        keyExtractor={item => item.teacher_id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadUnpaidSalaries} />}
        contentContainerStyle={unpaidTeachers.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState icon="💰" title="All up to date" message="No teachers with pending salary" />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.teacher_name || 'Unknown'}</Text>
            <Text style={styles.cardEmail}>{item.teacher_email || ''}</Text>
            <Text style={styles.amountText}>
              Unpaid: ₹{item.total_unpaid_amount?.toFixed(2) || '0.00'}
            </Text>
            <Text style={styles.monthsText}>
              {item.unpaid_months_count || 0} months pending
            </Text>
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => {
                setSelectedTeacher(item);
                const oldestMonth = item.unpaid_months && item.unpaid_months.length > 0
                  ? item.unpaid_months[item.unpaid_months.length - 1]
                  : null;
                setPaymentForm({
                  payment_date: new Date().toISOString().split('T')[0],
                  amount: oldestMonth ? oldestMonth.pending_amount?.toFixed(2) || '' : item.total_unpaid_amount?.toFixed(2) || '',
                  payment_mode: 'bank',
                  payment_proof: '',
                  notes: '',
                  salary_month: oldestMonth ? oldestMonth.month : new Date().getMonth() + 1,
                  salary_year: oldestMonth ? oldestMonth.year : new Date().getFullYear(),
                  payment_type: 'salary',
                });
                setShowPaymentModal(true);
              }}
            >
              <Text style={styles.payButtonText}>Record Payment</Text>
            </TouchableOpacity>
          </Card>
        )}
      />

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Record Payment - {selectedTeacher?.teacher_name}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Payment Amount *"
              keyboardType="decimal-pad"
              value={paymentForm.amount}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, amount: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Payment Date"
              value={paymentForm.payment_date}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, payment_date: text })}
            />
            <View style={styles.pickerRow}>
              <Text style={styles.label}>Payment Mode:</Text>
              <ScrollView horizontal>
                {['bank', 'cash', 'upi'].map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.pickerItem, paymentForm.payment_mode === mode && styles.pickerItemSelected]}
                    onPress={() => setPaymentForm({ ...paymentForm, payment_mode: mode as any })}
                  >
                    <Text style={paymentForm.payment_mode === mode ? styles.pickerItemTextSelected : styles.pickerItemText}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Month:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Month (1-12)"
                  keyboardType="number-pad"
                  value={paymentForm.salary_month.toString()}
                  onChangeText={(text) => setPaymentForm({ ...paymentForm, salary_month: parseInt(text) || 1 })}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Year:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Year"
                  keyboardType="number-pad"
                  value={paymentForm.salary_year.toString()}
                  onChangeText={(text) => setPaymentForm({ ...paymentForm, salary_year: parseInt(text) || new Date().getFullYear() })}
                />
              </View>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes (Optional)"
              multiline
              numberOfLines={2}
              value={paymentForm.notes}
              onChangeText={(text) => setPaymentForm({ ...paymentForm, notes: text })}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleRecordPayment}>
                <Text style={styles.submitButtonText}>Record Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Marks/Results View Screen
export function MarksResultsScreen({ navigation }: any) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');

  useEffect(() => {
    loadClasses();
    loadExams();
    loadResults();
  }, []);

  useEffect(() => {
    loadResults();
  }, [selectedClass, selectedExam]);

  const loadClasses = async () => {
    try {
      const data = await api.getClasses();
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadExams = async () => {
    try {
      const data = await api.getExams();
      setExams(data.exams || []);
    } catch (error) {
      console.error('Error loading exams:', error);
    }
  };

  const loadResults = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedClass) params.class_group_id = selectedClass;
      if (selectedExam) params.exam_id = selectedExam;
      const data = await api.getMarksResults(params);
      setResults(data.results || []);
    } catch (error: any) {
      console.error('Error loading results:', error);
      Alert.alert('Error', error.message || 'Failed to load results');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadResults();
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading results..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marks & Results</Text>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedClass && styles.filterChipActive]}
            onPress={() => setSelectedClass('')}
          >
            <Text style={[styles.filterChipText, !selectedClass && styles.filterChipTextActive]}>All Classes</Text>
          </TouchableOpacity>
          {classes.map(cls => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.filterChip, selectedClass === cls.id && styles.filterChipActive]}
              onPress={() => setSelectedClass(cls.id)}
            >
              <Text style={[styles.filterChipText, selectedClass === cls.id && styles.filterChipTextActive]}>
                {cls.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedExam && styles.filterChipActive]}
            onPress={() => setSelectedExam('')}
          >
            <Text style={[styles.filterChipText, !selectedExam && styles.filterChipTextActive]}>All Exams</Text>
          </TouchableOpacity>
          {exams.map(exam => (
            <TouchableOpacity
              key={exam.id}
              style={[styles.filterChip, selectedExam === exam.id && styles.filterChipActive]}
              onPress={() => setSelectedExam(exam.id)}
            >
              <Text style={[styles.filterChipText, selectedExam === exam.id && styles.filterChipTextActive]}>
                {exam.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item, index) => item.id || `result-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="📊" title="No results found" message="Try adjusting filters" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>
              {item.students?.profiles?.full_name || 'Unknown'} - {item.subjects?.name || 'N/A'}
            </Text>
            <Text style={styles.cardEmail}>
              Exam: {item.exams?.name || 'N/A'} | Class: {item.students?.class_groups?.name || 'N/A'}
            </Text>
            <Text style={styles.marksText}>
              Marks: {item.marks_obtained || 0} / {item.max_marks || 0} ({item.max_marks > 0 ? ((item.marks_obtained / item.max_marks) * 100).toFixed(1) : '0'}%)
            </Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  filters: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  filterRow: { marginBottom: 8 },
  classFilter: { marginTop: 8 },
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  classChipActive: { backgroundColor: '#2563eb' },
  classChipText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  classChipTextActive: { color: '#fff' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 8 },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  studentCard: { marginBottom: 12, padding: 16 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  studentEmail: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  className: { fontSize: 12, color: '#94a3b8' },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  amountText: { fontSize: 18, fontWeight: '700', color: '#2563eb', marginTop: 8 },
  monthsText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  marksText: { fontSize: 16, fontWeight: '600', color: '#10b981', marginTop: 8 },
  payButton: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  closeButton: { fontSize: 24, color: '#64748b' },
  ledgerContainer: { maxHeight: 400, marginBottom: 16 },
  monthSection: { marginBottom: 16 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  componentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  componentCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  componentName: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
  componentAmount: { fontSize: 16, fontWeight: '700', color: '#2563eb', marginRight: 8 },
  checkmark: { fontSize: 20, color: '#10b981' },
  collectButton: { marginTop: 16, padding: 16, borderRadius: 8, backgroundColor: '#10b981', alignItems: 'center' },
  collectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  pickerRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 8 },
  pickerItemSelected: { backgroundColor: '#2563eb' },
  pickerItemText: { fontSize: 14, color: '#64748b' },
  pickerItemTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});