import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerkClasses, useClerkStudents, useStudentMonthlyLedger, useCollectFeePayment } from '../hooks/useFeeCollection';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Student, ClassGroup, NavigationProp, MonthlyLedgerEntry } from '../../../shared/types';
import type { ClerkStackScreenProps } from '../../../navigation/types';

type Props = ClerkStackScreenProps<'FeeCollection'>;

interface FeeCollectionScreenProps {
  navigation: NavigationProp;
}

export function FeeCollectionScreen({ navigation }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash' as 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer',
    transaction_id: '',
    notes: '',
  });

  const { data: classesData } = useClerkClasses();
  const { data: studentsData, isLoading, refetch: refetchStudents, isRefetching: isRefetchingStudents } = useClerkStudents();
  const { data: ledgerData, isLoading: loadingLedger } = useStudentMonthlyLedger(
    selectedStudent?.id || '',
    !!selectedStudent
  );
  const collectPaymentMutation = useCollectFeePayment();

  const classes = classesData?.classes || [];
  const allStudents = studentsData?.students || [];
  const students = useMemo(() => {
    if (!selectedClass) return allStudents;
    return allStudents.filter(s => s.class_group_id === selectedClass);
  }, [allStudents, selectedClass]);
  const monthlyLedger = ledgerData?.ledger || [];

  const handleCollectPayment = () => {
    if (selectedComponents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one fee component');
      return;
    }
    if (!paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }

    collectPaymentMutation.mutate(
      {
        monthly_fee_component_ids: selectedComponents,
        payment_amount: parseFloat(paymentForm.payment_amount),
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        transaction_id: paymentForm.transaction_id || undefined,
        notes: paymentForm.notes || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Payment collected successfully');
          setShowPaymentModal(false);
          setSelectedComponents([]);
          setPaymentForm({
            payment_amount: '',
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'cash',
            transaction_id: '',
            notes: '',
          });
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to collect payment';
          Alert.alert('Error', message);
        },
      }
    );
  };

  const toggleComponentSelection = (componentId: string) => {
    setSelectedComponents(prev =>
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

  const totalPending = monthlyLedger
    .flatMap(month => month.components || [])
    .filter((comp) => selectedComponents.includes(comp.id))
    .reduce((sum: number, comp) => sum + (comp.pending_amount || 0), 0);

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
        refreshControl={<RefreshControl refreshing={isRefetchingStudents} onRefresh={() => refetchStudents()} />}
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
                  {monthlyLedger.map((month: MonthlyLedgerEntry, idx: number) => (
                    <View key={idx} style={styles.monthSection}>
                      <Text style={styles.monthTitle}>{month.period_start}</Text>
                      {(month.components || []).map((comp) => (
                        <TouchableOpacity
                          key={comp.id}
                          style={[
                            styles.componentCard,
                            selectedComponents.includes(comp.id) && styles.componentCardSelected
                          ]}
                          onPress={() => toggleComponentSelection(comp.id)}
                        >
                          <Text style={styles.componentName}>{comp.component_name}</Text>
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
                    onPress={() => setPaymentForm({ ...paymentForm, payment_mode: mode as 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer' })}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  filters: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  classFilter: { marginTop: 8 },
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  classChipActive: { backgroundColor: '#2563eb' },
  classChipText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  classChipTextActive: { color: '#fff' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  studentCard: { marginBottom: 12, padding: 16 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  studentEmail: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  className: { fontSize: 12, color: '#94a3b8' },
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
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
