import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useUnpaidSalaries,
  useSalarySummary,
  useSalaryPaymentHistory,
  useRecordSalaryPayment,
} from '../hooks/useSalaryPayment';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { ClerkStackScreenProps } from '../../../navigation/types';
import type { UnpaidSalaryTeacher } from '../../../shared/types';

type Props = ClerkStackScreenProps<'SalaryPayment'>;

type SelectedTeacherPayload = UnpaidSalaryTeacher & {
  selectedMonth?: {
    month: number;
    year: number;
    period_label: string;
    net_salary: number;
    paid_amount: number;
    credit_applied: number;
    effective_paid_amount: number;
    pending_amount: number;
  };
  total_salary_due?: number;
  total_salary_paid?: number;
  pending_salary?: number;
};

const PAYMENT_TYPES: Array<'salary' | 'advance' | 'adjustment' | 'bonus' | 'loan' | 'other'> = [
  'salary',
  'advance',
  'adjustment',
  'bonus',
  'loan',
  'other',
];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

export function SalaryPaymentScreen({ navigation }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTeacherForHistory, setSelectedTeacherForHistory] = useState<{ id: string; name: string } | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<SelectedTeacherPayload | null>(null);
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

  const { data: salariesData, isLoading, refetch, isRefetching } = useUnpaidSalaries('last_12_months');
  const { data: summaryData } = useSalarySummary();
  const { data: historyData, isLoading: loadingHistory } = useSalaryPaymentHistory(
    selectedTeacherForHistory?.id || '',
    showHistoryModal && !!selectedTeacherForHistory?.id,
    { page: 1, limit: 50 }
  );
  const recordPaymentMutation = useRecordSalaryPayment();

  const unpaidTeachers = salariesData?.teachers || [];
  const summaries = summaryData?.summaries || [];

  const closePaymentModal = () => {
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
  };

  // When modal is open, back button / header back should close modal first
  useEffect(() => {
    if (!showPaymentModal) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!showPaymentModal) return;
      e.preventDefault();
      closePaymentModal();
    });
    return unsubscribe;
  }, [showPaymentModal, navigation]);

  const openPaymentModal = (teacher: UnpaidSalaryTeacher, month?: any) => {
    const summary = summaries.find((s: any) => s.teacher_id === teacher.teacher_id || (s.teacher && s.teacher.id) === teacher.teacher_id);
    const payload: SelectedTeacherPayload = {
      ...teacher,
      total_salary_due: summary?.total_salary_due ?? 0,
      total_salary_paid: summary?.total_salary_paid ?? 0,
      pending_salary: teacher.total_unpaid_amount,
      selectedMonth: month,
    };
    const oldestMonth = teacher.unpaid_months && teacher.unpaid_months.length > 0
      ? teacher.unpaid_months[teacher.unpaid_months.length - 1]
      : null;
    const prefillMonth = month ?? oldestMonth;
    setSelectedTeacher(payload);
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      amount: (prefillMonth?.pending_amount ?? teacher.total_unpaid_amount)?.toFixed(2) ?? '',
      payment_mode: 'bank',
      payment_proof: '',
      notes: '',
      salary_month: prefillMonth?.month ?? new Date().getMonth() + 1,
      salary_year: prefillMonth?.year ?? new Date().getFullYear(),
      payment_type: 'salary',
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = () => {
    if (!selectedTeacher) return;
    const amount = parseFloat(paymentForm.amount || '0');
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }
    const expectedSalary = selectedTeacher.selectedMonth?.net_salary ?? selectedTeacher.pending_salary ?? selectedTeacher.total_unpaid_amount ?? 0;
    if (amount > expectedSalary) {
      const excess = amount - expectedSalary;
      Alert.alert(
        'Excess Amount',
        `Payment amount (₹${amount.toLocaleString()}) exceeds expected (₹${expectedSalary.toLocaleString()}). Excess (₹${excess.toLocaleString()}) will be applied as credit to future months. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => submitPayment(amount) },
        ]
      );
      return;
    }
    submitPayment(amount);
  };

  const submitPayment = (amount: number) => {
    if (!selectedTeacher) return;
    recordPaymentMutation.mutate(
      {
        teacher_id: selectedTeacher.teacher_id,
        payment_date: paymentForm.payment_date,
        amount,
        payment_mode: paymentForm.payment_mode,
        payment_proof: paymentForm.payment_proof || undefined,
        notes: paymentForm.notes || undefined,
        salary_month: paymentForm.salary_month,
        salary_year: paymentForm.salary_year,
        payment_type: paymentForm.payment_type,
      },
      {
        onSuccess: (result: any) => {
          let message = 'Payment recorded successfully!';
          if (result.excess_amount && result.excess_amount > 0) {
            const cred = result.credit_applied || {};
            message += `\n\nExcess: ₹${result.excess_amount.toFixed(2)}\nCredit applied: ₹${(cred.applied_amount ?? 0).toFixed(2)}\nMonths applied: ${cred.months_applied ?? 0}\nRemaining credit: ₹${(cred.remaining_credit ?? 0).toFixed(2)}`;
          }
          Alert.alert('Success', message);
          closePaymentModal();
          refetch();
        },
        onError: (error: unknown) => {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to record payment');
        },
      }
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading teacher salary information..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pay Salary</Text>
        <Text style={styles.subtitle}>
          Record salary payments directly. You can pay full, partial, or advance payments to teachers.
        </Text>
      </View>

      <FlatList
        data={unpaidTeachers}
        keyExtractor={(item) => item.teacher_id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={unpaidTeachers.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="💰"
            title="No teachers with pending salary"
            message="All teachers are up to date with their payments."
          />
        }
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.teacher_id;
          const hasMonths = (item.unpaid_months?.length ?? 0) > 0;
          return (
            <Card style={styles.card}>
              <TouchableOpacity
                onPress={() => hasMonths && setExpandedId((id) => (id === item.teacher_id ? null : item.teacher_id))}
                style={styles.cardHeader}
              >
                {hasMonths && (
                  <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                )}
                <View style={styles.cardMain}>
                  <Text style={styles.cardName}>{item.teacher_name || 'Unknown'}</Text>
                  <Text style={styles.cardEmail}>{item.teacher_email || '-'}</Text>
                  <View style={styles.badges}>
                    <Text style={styles.badge}>
                      {item.unpaid_months_count ?? 0} {item.unpaid_months_count === 1 ? 'month' : 'months'}
                    </Text>
                    <Text style={styles.amountText}>₹{(item.total_unpaid_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.recordButton} onPress={() => openPaymentModal(item)}>
                  <Text style={styles.recordButtonText}>Record Payment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => {
                    setSelectedTeacherForHistory({ id: item.teacher_id, name: item.teacher_name || 'Unknown' });
                    setShowHistoryModal(true);
                  }}
                >
                  <Text style={styles.historyButtonText}>View History</Text>
                </TouchableOpacity>
              </View>
              {isExpanded && hasMonths && (
                <View style={styles.breakdown}>
                  <Text style={styles.breakdownTitle}>Monthly Breakdown</Text>
                  {(item.unpaid_months || []).map((month: any, idx: number) => (
                    <View key={`${month.year}-${month.month}-${idx}`} style={styles.breakdownRow}>
                      <Text style={styles.breakdownMonth}>{month.period_label ?? `${month.month}/${month.year}`}</Text>
                      <Text style={styles.breakdownStatus}>{month.payment_status === 'paid' ? 'Paid' : month.payment_status === 'partially-paid' ? 'Partially Paid' : 'Unpaid'}</Text>
                      <Text style={styles.breakdownAmount}>₹{(month.pending_amount ?? month.net_salary ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      <TouchableOpacity
                        style={styles.payMonthButton}
                        onPress={() => openPaymentModal(item, month)}
                      >
                        <Text style={styles.payMonthButtonText}>Pay</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalTopBar}>
              <Text style={styles.modalTitle}>Record Salary Payment</Text>
              <TouchableOpacity
                onPress={closePaymentModal}
                style={styles.modalCloseButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {selectedTeacher && (
                <>
                  <Text style={styles.modalSubtext}>Teacher: {selectedTeacher.teacher_name}</Text>
                  {selectedTeacher.selectedMonth && (
                    <Text style={styles.payingFor}>Paying for: {selectedTeacher.selectedMonth.period_label}</Text>
                  )}
                  <View style={styles.summaryBox}>
                    {selectedTeacher.selectedMonth ? (
                      <>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Month Salary</Text>
                          <Text style={styles.summaryValue}>₹{(selectedTeacher.selectedMonth.net_salary ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                        {(selectedTeacher.selectedMonth.paid_amount ?? 0) > 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Cash Paid</Text>
                            <Text style={styles.summaryValueGreen}>₹{(selectedTeacher.selectedMonth.paid_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                          </View>
                        )}
                        {(selectedTeacher.selectedMonth.credit_applied ?? 0) > 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Credit Applied</Text>
                            <Text style={styles.summaryValueBlue}>₹{(selectedTeacher.selectedMonth.credit_applied ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                          </View>
                        )}
                        <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                          <Text style={styles.summaryLabel}>Pending for this month</Text>
                          <Text style={styles.summaryValueOrange}>₹{(selectedTeacher.selectedMonth.pending_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Total Due</Text>
                          <Text style={styles.summaryValue}>₹{(selectedTeacher.total_salary_due ?? selectedTeacher.total_unpaid_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Total Paid</Text>
                          <Text style={styles.summaryValueGreen}>₹{(selectedTeacher.total_salary_paid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                          <Text style={styles.summaryLabel}>Pending</Text>
                          <Text style={styles.summaryValueOrange}>₹{(selectedTeacher.pending_salary ?? selectedTeacher.total_unpaid_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}

              <Text style={styles.label}>Payment Amount (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter payment amount"
                keyboardType="decimal-pad"
                value={paymentForm.amount}
                onChangeText={(t) => setPaymentForm({ ...paymentForm, amount: t })}
              />
              <Text style={styles.hint}>
                You can pay full, partial, or advance amounts.
                {selectedTeacher?.selectedMonth
                  ? ` Expected: ₹${(selectedTeacher.selectedMonth.net_salary ?? 0).toFixed(2)}. Pending: ₹${(selectedTeacher.selectedMonth.pending_amount ?? 0).toFixed(2)}.`
                  : ` Pending: ₹${(selectedTeacher?.pending_salary ?? selectedTeacher?.total_unpaid_amount ?? 0).toFixed(2)}.`}
                {selectedTeacher?.selectedMonth && parseFloat(paymentForm.amount) > (selectedTeacher.selectedMonth.net_salary ?? 0) && (
                  ' Excess will be applied as credit to future months.'
                )}
              </Text>

              <Text style={styles.label}>Salary Month *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {MONTHS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, paymentForm.salary_month === m && styles.pickerItemSelected]}
                    onPress={() => setPaymentForm({ ...paymentForm, salary_month: m })}
                  >
                    <Text style={paymentForm.salary_month === m ? styles.pickerItemTextSelected : styles.pickerItemText}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Salary Year *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {YEARS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.pickerItem, paymentForm.salary_year === y && styles.pickerItemSelected]}
                    onPress={() => setPaymentForm({ ...paymentForm, salary_year: y })}
                  >
                    <Text style={paymentForm.salary_year === y ? styles.pickerItemTextSelected : styles.pickerItemText}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Payment Date *</Text>
              <TextInput
                style={styles.input}
                value={paymentForm.payment_date}
                onChangeText={(t) => setPaymentForm({ ...paymentForm, payment_date: t })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.label}>Payment Mode *</Text>
              <View style={styles.pickerRow}>
                {(['bank', 'cash', 'upi'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.pickerItem, paymentForm.payment_mode === mode && styles.pickerItemSelected]}
                    onPress={() => setPaymentForm({ ...paymentForm, payment_mode: mode })}
                  >
                    <Text style={paymentForm.payment_mode === mode ? styles.pickerItemTextSelected : styles.pickerItemText}>
                      {mode === 'bank' ? 'Bank' : mode === 'upi' ? 'UPI' : 'Cash'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Payment Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {PAYMENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pickerItem, paymentForm.payment_type === type && styles.pickerItemSelected]}
                    onPress={() => setPaymentForm({ ...paymentForm, payment_type: type })}
                  >
                    <Text style={paymentForm.payment_type === type ? styles.pickerItemTextSelected : styles.pickerItemText}>
                      {type === 'salary' ? 'Salary' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Payment Proof (Optional)</Text>
              <TextInput
                style={styles.input}
                value={paymentForm.payment_proof}
                onChangeText={(t) => setPaymentForm({ ...paymentForm, payment_proof: t })}
                placeholder="URL or file path to payment proof"
              />

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
                <TouchableOpacity style={styles.cancelButton} onPress={closePaymentModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleRecordPayment}>
                  <Text style={styles.submitButtonText}>Record Payment</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View History Modal */}
      <Modal visible={showHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment History - {selectedTeacherForHistory?.name}</Text>
              <TouchableOpacity onPress={() => { setShowHistoryModal(false); setSelectedTeacherForHistory(null); }}>
                <Text style={styles.closeButton}>Close</Text>
              </TouchableOpacity>
            </View>
            {loadingHistory ? (
              <LoadingSpinner message="Loading payment history..." />
            ) : !historyData?.payments?.length ? (
              <Text style={styles.emptyHistory}>No payment records found</Text>
            ) : (
              <ScrollView>
                {historyData.summary && (
                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total paid (till date)</Text>
                      <Text style={styles.summaryValue}>₹{(historyData.summary.total_paid_till_date ?? historyData.summary.total_paid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                    {(historyData.summary.pending_amount ?? 0) > 0 && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Pending</Text>
                        <Text style={styles.summaryValueOrange}>₹{(historyData.summary.pending_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      </View>
                    )}
                  </View>
                )}
                {(historyData.payments || []).map((p: any) => (
                  <View key={p.id} style={styles.paymentRow}>
                    <Text style={styles.paymentDate}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</Text>
                    <Text style={styles.paymentAmount}>₹{(p.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    <Text style={styles.paymentMode}>{(p.payment_mode || '').toUpperCase()} · {(p.payment_type_label || p.payment_type || 'salary').replace(/_/g, ' ')}</Text>
                    {p.salary_period_label && <Text style={styles.paymentPeriod}>{p.salary_period_label}</Text>}
                  </View>
                ))}
              </ScrollView>
            )}
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
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8 },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  expandIcon: { fontSize: 14, color: '#64748b', marginRight: 8 },
  cardMain: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: { fontSize: 12, backgroundColor: '#fed7aa', color: '#9a3412', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  amountText: { fontSize: 16, fontWeight: '700', color: '#ea580c' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  recordButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
  recordButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  historyButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#059669', alignItems: 'center' },
  historyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  breakdown: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  breakdownTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  breakdownMonth: { fontSize: 14, fontWeight: '600', minWidth: 80 },
  breakdownStatus: { fontSize: 12, color: '#64748b', flex: 1 },
  breakdownAmount: { fontSize: 14, fontWeight: '600', color: '#ea580c' },
  payMonthButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#2563eb' },
  payMonthButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalScroll: { paddingBottom: 24 },
  modalScrollView: { flexGrow: 0, maxHeight: '85%' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, maxHeight: '90%' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalCloseButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9' },
  modalCloseButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', flex: 1 },
  modalSubtext: { fontSize: 14, color: '#64748b', marginTop: 4 },
  payingFor: { fontSize: 14, fontWeight: '600', color: '#2563eb', marginTop: 4 },
  closeButton: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  summaryBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 },
  summaryLabel: { fontSize: 14, color: '#64748b' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  summaryValueGreen: { fontSize: 14, fontWeight: '600', color: '#059669' },
  summaryValueBlue: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  summaryValueOrange: { fontSize: 14, fontWeight: '600', color: '#ea580c' },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fff' },
  textArea: { minHeight: 64, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
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
  paymentAmount: { fontSize: 16, fontWeight: '700', color: '#059669' },
  paymentMode: { fontSize: 12, color: '#64748b' },
  paymentPeriod: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
