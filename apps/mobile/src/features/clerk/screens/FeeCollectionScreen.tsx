import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useClerkClasses,
  useStudentsForFeeCollection,
  useStudentFeeStructure,
  useStudentPayments,
  useCollectFeePayment,
} from '../hooks/useFeeCollection';
import type { StudentForFeeCollection } from '../../../shared/services/clerk.service';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { ClerkStackScreenProps } from '../../../navigation/types';

type Props = ClerkStackScreenProps<'FeeCollection'>;

function isFutureMonth(year: number, month: number): boolean {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  return year > currentYear || (year === currentYear && month > currentMonth);
}

export function FeeCollectionScreen({ navigation }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentForFeeCollection | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{ receipt_number?: string; payment?: any } | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash' as 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer',
    transaction_id: '',
    cheque_number: '',
    bank_name: '',
    notes: '',
  });

  const { data: classesData } = useClerkClasses();
  const { data: studentsData, isLoading, refetch: refetchStudents, isRefetching } = useStudentsForFeeCollection(
    selectedClass || undefined,
    1,
    50
  );
  const { data: feeData, isLoading: loadingLedger } = useStudentFeeStructure(
    selectedStudent?.id || '',
    !!selectedStudent
  );
  const { data: paymentsData, isLoading: loadingHistory } = useStudentPayments(
    selectedStudent?.id || '',
    showHistoryModal && !!selectedStudent
  );
  const collectPaymentMutation = useCollectFeePayment();

  const classes = classesData?.classes || [];
  const allStudents = studentsData?.students || [];
  const students = useMemo(() => {
    if (!searchQuery.trim()) return allStudents;
    const q = searchQuery.toLowerCase().trim();
    return allStudents.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.roll_number || '').toLowerCase().includes(q)
    );
  }, [allStudents, searchQuery]);

  const monthlyLedger = feeData?.monthly_ledger || [];
  const feeStructure = feeData?.fee_structure;
  const noFeeConfigured = feeData?.fee_structure === null && !!feeData?.message;
  const totalPendingAll = useMemo(
    () =>
      monthlyLedger
        .flatMap((m: any) => m.components || [])
        .reduce((sum: number, c: any) => sum + (c.pending_amount || 0), 0),
    [monthlyLedger]
  );
  const totalPending = useMemo(
    () =>
      monthlyLedger
        .flatMap((m: any) => m.components || [])
        .filter((c: any) => selectedComponents.includes(c.id))
        .reduce((sum: number, c: any) => sum + (c.pending_amount || 0), 0),
    [monthlyLedger, selectedComponents]
  );

  const handleCollectPayment = () => {
    if (selectedComponents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one fee component');
      return;
    }
    const amount = parseFloat(paymentForm.payment_amount || '0');
    if (!paymentForm.payment_amount || amount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }
    if (amount > totalPending) {
      Alert.alert('Validation Error', `Payment amount cannot exceed total pending (₹${totalPending.toFixed(2)})`);
      return;
    }

    collectPaymentMutation.mutate(
      {
        monthly_fee_component_ids: selectedComponents,
        payment_amount: amount,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        transaction_id: paymentForm.transaction_id || undefined,
        cheque_number: paymentForm.cheque_number || undefined,
        bank_name: paymentForm.bank_name || undefined,
        notes: paymentForm.notes || undefined,
        studentId: selectedStudent?.id,
      },
      {
        onSuccess: (data: any) => {
          setReceiptData({ receipt_number: data?.receipt_number, payment: data?.payment });
          setShowReceipt(true);
          setShowPaymentModal(false);
          setSelectedComponents([]);
          setPaymentForm({
            payment_amount: '',
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'cash',
            transaction_id: '',
            cheque_number: '',
            bank_name: '',
            notes: '',
          });
          refetchStudents();
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to collect payment';
          Alert.alert('Error', message);
        },
      }
    );
  };

  const toggleComponentSelection = (componentId: string, year: number, month: number) => {
    if (isFutureMonth(year, month)) {
      Alert.alert('Note', 'Future months require Principal approval.');
      return;
    }
    setSelectedComponents((prev) =>
      prev.includes(componentId) ? prev.filter((id) => id !== componentId) : [...prev, componentId]
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fee Collection</Text>
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Filter by Class (Optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classFilter}>
          <TouchableOpacity
            style={[styles.classChip, !selectedClass && styles.classChipActive]}
            onPress={() => setSelectedClass('')}
          >
            <Text style={[styles.classChipText, !selectedClass && styles.classChipTextActive]}>All Classes</Text>
          </TouchableOpacity>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.classChip, selectedClass === cls.id && styles.classChipActive]}
              onPress={() => setSelectedClass(cls.id)}
            >
              <Text style={[styles.classChipText, selectedClass === cls.id && styles.classChipTextActive]}>{cls.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.filterLabel}>Search by Name</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={selectedClass ? `Search in ${classes.find((c) => c.id === selectedClass)?.name || 'class'}...` : 'Type student name...'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetchStudents()} />}
        contentContainerStyle={students.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="No students found"
            message={searchQuery ? `No match for "${searchQuery}"` : 'Select a class or type to search'}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.studentCard}>
            <TouchableOpacity onPress={() => setSelectedStudent(item)}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentMeta}>Roll: {item.roll_number} | Class: {item.class}</Text>
            </TouchableOpacity>
          </Card>
        )}
      />

      {/* Student fee drawer modal */}
      {selectedStudent && (
        <Modal visible={!!selectedStudent} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedStudent.name}</Text>
                  <Text style={styles.modalSubtext}>Roll: {selectedStudent.roll_number} | Class: {selectedStudent.class}</Text>
                  {totalPendingAll > 0 && (
                    <Text style={styles.totalPendingBadge}>Total Pending: ₹{totalPendingAll.toFixed(2)}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedStudent(null);
                    setSelectedComponents([]);
                    setShowHistoryModal(false);
                  }}
                >
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>

              {loadingLedger ? (
                <LoadingSpinner message="Loading fee data..." />
              ) : noFeeConfigured ? (
                <View style={styles.noFeeCard}>
                  <Text style={styles.noFeeTitle}>⚠️ No fee configured for this student</Text>
                  <Text style={styles.noFeeText}>Please contact Principal to assign fee structure.</Text>
                </View>
              ) : (
                <ScrollView style={styles.ledgerContainer}>
                  {monthlyLedger.map((month: any, idx: number) => (
                    <View key={idx} style={styles.monthSection}>
                      <Text style={styles.monthTitle}>{month.month ?? `${month.period_month ?? ''}/${month.period_year ?? ''}`}</Text>
                      {(month.components || []).map((comp: any) => {
                        const isFuture = isFutureMonth(month.year ?? 0, month.monthNumber ?? month.period_month ?? 0);
                        const isDisabled = comp.status === 'paid' || (comp.pending_amount || 0) === 0 || isFuture;
                        const feeName = comp.fee_name ?? comp.component_name ?? 'Fee';
                        return (
                          <TouchableOpacity
                            key={comp.id}
                            style={[
                              styles.componentCard,
                              selectedComponents.includes(comp.id) && styles.componentCardSelected,
                              isDisabled && styles.componentCardDisabled,
                            ]}
                            onPress={() => !isDisabled && toggleComponentSelection(comp.id, month.year ?? 0, month.monthNumber ?? month.period_month ?? 0)}
                            disabled={isDisabled}
                          >
                            <View style={styles.componentRow}>
                              <Text style={styles.componentName}>{feeName}</Text>
                              <Text style={styles.componentAmount}>₹{comp.pending_amount ?? 0}</Text>
                            </View>
                            <Text style={styles.componentStatus}>{comp.status ?? 'pending'}</Text>
                            {selectedComponents.includes(comp.id) && <Text style={styles.checkmark}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                  {monthlyLedger.length === 0 && !noFeeConfigured && (
                    <EmptyState icon="💵" title="No fee data" message="No fee data available for this student" />
                  )}
                </ScrollView>
              )}

              <View style={styles.drawerActions}>
                <TouchableOpacity style={styles.historyButton} onPress={() => setShowHistoryModal(true)}>
                  <Text style={styles.historyButtonText}>View History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.collectButton, selectedComponents.length === 0 && styles.collectButtonDisabled]}
                  onPress={() => {
                    if (selectedComponents.length > 0) {
                      setPaymentForm((prev) => ({ ...prev, payment_amount: totalPending.toFixed(2) }));
                      setShowPaymentModal(true);
                    }
                  }}
                  disabled={selectedComponents.length === 0}
                >
                  <Text style={styles.collectButtonText}>Collect ({selectedComponents.length})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Payment form modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.paymentModalInner}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Collect Fee</Text>
              {selectedStudent && (
                <Text style={styles.modalSubtext}>{selectedStudent.name} · {selectedStudent.class}</Text>
              )}

              <Text style={styles.label}>Payment Mode *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {['cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.pickerItem, paymentForm.payment_mode === mode && styles.pickerItemSelected]}
                    onPress={() => setPaymentForm({ ...paymentForm, payment_mode: mode as any })}
                  >
                    <Text style={paymentForm.payment_mode === mode ? styles.pickerItemTextSelected : styles.pickerItemText}>{mode.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Payment Amount *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={paymentForm.payment_amount}
                onChangeText={(t) => setPaymentForm({ ...paymentForm, payment_amount: t })}
              />
              <Text style={styles.hint}>Max: ₹{totalPending.toFixed(2)} (Total Pending)</Text>

              <Text style={styles.label}>Payment Date *</Text>
              <TextInput
                style={styles.input}
                value={paymentForm.payment_date}
                onChangeText={(t) => setPaymentForm({ ...paymentForm, payment_date: t })}
                placeholder="YYYY-MM-DD"
              />

              {(paymentForm.payment_mode === 'upi' || paymentForm.payment_mode === 'online' || paymentForm.payment_mode === 'card') && (
                <>
                  <Text style={styles.label}>Transaction ID</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentForm.transaction_id}
                    onChangeText={(t) => setPaymentForm({ ...paymentForm, transaction_id: t })}
                    placeholder="Enter transaction ID"
                  />
                </>
              )}
              {paymentForm.payment_mode === 'cheque' && (
                <>
                  <Text style={styles.label}>Cheque Number</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentForm.cheque_number}
                    onChangeText={(t) => setPaymentForm({ ...paymentForm, cheque_number: t })}
                    placeholder="Enter cheque number"
                  />
                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentForm.bank_name}
                    onChangeText={(t) => setPaymentForm({ ...paymentForm, bank_name: t })}
                    placeholder="Enter bank name"
                  />
                </>
              )}
              {paymentForm.payment_mode === 'bank_transfer' && (
                <>
                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentForm.bank_name}
                    onChangeText={(t) => setPaymentForm({ ...paymentForm, bank_name: t })}
                    placeholder="Enter bank name"
                  />
                </>
              )}

              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={paymentForm.notes}
                onChangeText={(t) => setPaymentForm({ ...paymentForm, notes: t })}
                placeholder="Additional notes..."
                multiline
                numberOfLines={2}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPaymentModal(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleCollectPayment}>
                  <Text style={styles.submitButtonText}>Save & Collect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Payment history modal */}
      {selectedStudent && (
        <Modal visible={showHistoryModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment History - {selectedStudent.name}</Text>
                <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                  <Text style={styles.closeButton}>Close</Text>
                </TouchableOpacity>
              </View>
              {loadingHistory ? (
                <LoadingSpinner message="Loading payment history..." />
              ) : !paymentsData?.payments?.length ? (
                <Text style={styles.emptyHistory}>No payment records found</Text>
              ) : (
                <ScrollView>
                  {(paymentsData.payments || []).map((p: any) => (
                    <View key={p.id} style={styles.paymentRow}>
                      <Text style={styles.paymentDate}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</Text>
                      <Text style={styles.paymentAmount}>₹{(p.payment_amount ?? 0).toFixed(2)}</Text>
                      <Text style={styles.paymentMode}>{(p.payment_mode || '').toUpperCase()}</Text>
                      {p.receipt_number && <Text style={styles.paymentReceipt}>Receipt: {p.receipt_number}</Text>}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Receipt modal */}
      <Modal visible={showReceipt} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Payment Receipt</Text>
            {receiptData && (
              <>
                <Text style={styles.receiptNumber}>Receipt No: {receiptData.receipt_number ?? 'N/A'}</Text>
                <Text style={styles.receiptAmount}>
                  Amount: ₹{(receiptData.payment?.amount_paid ?? receiptData.payment?.payment_amount ?? 0).toFixed(2)}
                </Text>
                <Text style={styles.receiptDate}>
                  Date: {receiptData.payment?.payment_date ? new Date(receiptData.payment.payment_date).toLocaleDateString() : '—'}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                setShowReceipt(false);
                setReceiptData(null);
              }}
            >
              <Text style={styles.submitButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  filters: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 8 },
  classFilter: { marginBottom: 8 },
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  classChipActive: { backgroundColor: '#2563eb' },
  classChipText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  classChipTextActive: { color: '#fff' },
  searchInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  list: { padding: 16 },
  emptyContainer: { flex: 1, padding: 16 },
  studentCard: { marginBottom: 12, padding: 16 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  studentMeta: { fontSize: 14, color: '#64748b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  modalSubtext: { fontSize: 14, color: '#64748b', marginTop: 4 },
  closeButton: { fontSize: 24, color: '#64748b', fontWeight: '600' },
  totalPendingBadge: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#b91c1c', backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  noFeeCard: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 12, padding: 16 },
  noFeeTitle: { fontSize: 16, fontWeight: '700', color: '#92400e' },
  noFeeText: { fontSize: 14, color: '#b45309', marginTop: 8 },
  ledgerContainer: { maxHeight: 320, marginBottom: 16 },
  monthSection: { marginBottom: 16 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  componentCard: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  componentCardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  componentCardDisabled: { opacity: 0.6 },
  componentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  componentName: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
  componentAmount: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  componentStatus: { fontSize: 12, color: '#64748b', marginTop: 4 },
  checkmark: { fontSize: 18, color: '#10b981', marginTop: 4 },
  drawerActions: { flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  historyButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#10b981', alignItems: 'center' },
  historyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  collectButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
  collectButtonDisabled: { backgroundColor: '#94a3b8', opacity: 0.8 },
  collectButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  paymentModalInner: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  textArea: { minHeight: 64 },
  pickerRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  pickerItemSelected: { backgroundColor: '#2563eb' },
  pickerItemText: { fontSize: 14, color: '#64748b' },
  pickerItemTextSelected: { fontSize: 14, color: '#fff', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  submitButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyHistory: { fontSize: 16, color: '#64748b', textAlign: 'center', padding: 24 },
  paymentRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  paymentDate: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  paymentAmount: { fontSize: 16, fontWeight: '700', color: '#10b981' },
  paymentMode: { fontSize: 12, color: '#64748b' },
  paymentReceipt: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  receiptNumber: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  receiptAmount: { fontSize: 18, fontWeight: '700', color: '#10b981', marginBottom: 4 },
  receiptDate: { fontSize: 14, color: '#64748b', marginBottom: 16 },
});
