import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUnpaidSalaries, useRecordSalaryPayment } from '../hooks/useSalaryPayment';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { NavigationProp, UnpaidSalaryTeacher } from '../../../shared/types';

interface SalaryPaymentScreenProps {
  navigation: NavigationProp;
}

export function SalaryPaymentScreen({ navigation }: SalaryPaymentScreenProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UnpaidSalaryTeacher | null>(null);
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
  const recordPaymentMutation = useRecordSalaryPayment();

  const unpaidTeachers = salariesData?.teachers || [];

  const handleRecordPayment = () => {
    if (!selectedTeacher) return;
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount');
      return;
    }

    recordPaymentMutation.mutate(
      {
        teacher_id: selectedTeacher.teacher_id,
        payment_date: paymentForm.payment_date,
        amount: parseFloat(paymentForm.amount),
        payment_mode: paymentForm.payment_mode,
        payment_proof: paymentForm.payment_proof || undefined,
        notes: paymentForm.notes || undefined,
        salary_month: paymentForm.salary_month,
        salary_year: paymentForm.salary_year,
        payment_type: paymentForm.payment_type,
      },
      {
        onSuccess: (result) => {
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
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to record payment';
          Alert.alert('Error', message);
        },
      }
    );
  };

  if (isLoading) {
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
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
                    onPress={() => setPaymentForm({ ...paymentForm, payment_mode: mode as 'bank' | 'cash' | 'upi' })}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  amountText: { fontSize: 18, fontWeight: '700', color: '#2563eb', marginTop: 8 },
  monthsText: { fontSize: 12, color: '#64748b', marginTop: 4 },
  payButton: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
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
