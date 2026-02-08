import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeacherSalary } from '../hooks/useTeacherSalary';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useAuth } from '../../../navigation/AuthContext';
import { NavigationProp } from '../../../shared/types';

interface MySalaryScreenProps {
  navigation: NavigationProp;
}

export function MySalaryScreen({ navigation }: MySalaryScreenProps) {
  const { user } = useAuth();
  const { data: salaryData, isLoading, refetch, isRefetching } = useTeacherSalary(user?.id || '');
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const salaryStructure = salaryData?.structure;
  const salaryRecords = salaryData?.records || [];

  const sortedRecords = [...salaryRecords].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading salary..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Salary</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowPaymentHistory(true)}
          >
            <Text style={styles.historyButtonText}>💰 View Payment History</Text>
          </TouchableOpacity>
        </View>

        {/* Salary Structure */}
        <Card style={styles.structureCard}>
          <Text style={styles.sectionTitle}>Salary Structure</Text>
          {salaryStructure ? (
            <View style={styles.structureGrid}>
              <View style={styles.structureItem}>
                <Text style={styles.structureLabel}>Base Salary</Text>
                <Text style={styles.structureValue}>
                  ₹{parseFloat(String(salaryStructure.base_salary || 0)).toLocaleString()}
                </Text>
              </View>
              <View style={styles.structureItem}>
                <Text style={styles.structureLabel}>HRA</Text>
                <Text style={styles.structureValue}>
                  ₹{parseFloat(String(salaryStructure.hra || 0)).toLocaleString()}
                </Text>
              </View>
              <View style={styles.structureItem}>
                <Text style={styles.structureLabel}>Other Allowances</Text>
                <Text style={styles.structureValue}>
                  ₹{parseFloat(String(salaryStructure.other_allowances || 0)).toLocaleString()}
                </Text>
              </View>
              <View style={styles.structureItem}>
                <Text style={styles.structureLabel}>Fixed Deductions</Text>
                <Text style={[styles.structureValue, styles.deductionValue]}>
                  ₹{parseFloat(String(salaryStructure.fixed_deductions || 0)).toLocaleString()}
                </Text>
              </View>
              <View style={styles.structureItem}>
                <Text style={styles.structureLabel}>Salary Cycle</Text>
                <Text style={styles.structureValue}>
                  {(salaryStructure.salary_cycle || 'monthly').toUpperCase()}
                </Text>
              </View>
              <View style={styles.structureItem}>
                <Text style={styles.structureLabel}>Attendance-Based Deduction</Text>
                <Text style={styles.structureValue}>
                  {salaryStructure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled'}
                </Text>
              </View>
              <View style={[styles.structureItem, styles.grossSalaryItem]}>
                <Text style={styles.grossLabel}>Gross Salary</Text>
                <Text style={styles.grossValue}>
                  ₹{(
                    parseFloat(String(salaryStructure.base_salary || 0)) +
                    parseFloat(String(salaryStructure.hra || 0)) +
                    parseFloat(String(salaryStructure.other_allowances || 0))
                  ).toLocaleString()}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noStructure}>
              Salary structure not set yet. Please contact your principal.
            </Text>
          )}
        </Card>

        {/* Salary Records */}
        <Card style={styles.recordsCard}>
          <Text style={styles.sectionTitle}>Salary History</Text>
          {sortedRecords.length === 0 ? (
            <EmptyState icon="💰" title="No salary records" message="Salary records will appear here once generated" />
          ) : (
            <FlatList
              data={sortedRecords}
              keyExtractor={(item) => item.id || `${item.month}-${item.year}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.recordItem}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordMonth}>
                      {new Date(2000, item.month - 1).toLocaleString('default', { month: 'long' })} {item.year}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        item.status === 'paid' && styles.statusPaid,
                        item.status === 'approved' && styles.statusApproved,
                        item.status === 'pending' && styles.statusPending,
                        item.status === 'rejected' && styles.statusRejected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.status === 'paid' && styles.statusTextPaid,
                          item.status === 'approved' && styles.statusTextApproved,
                          item.status === 'pending' && styles.statusTextPending,
                          item.status === 'rejected' && styles.statusTextRejected,
                        ]}
                      >
                        {item.status === 'pending' ? 'Pending Approval' :
                         item.status === 'approved' ? 'Approved' :
                         item.status === 'rejected' ? 'Rejected' :
                         item.status === 'paid' ? 'Paid' :
                         item.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.recordDetails}>
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Gross Salary:</Text>
                      <Text style={styles.recordValue}>₹{item.gross_salary?.toLocaleString() || '0'}</Text>
                    </View>
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Total Deductions:</Text>
                      <Text style={[styles.recordValue, styles.deductionValue]}>
                        ₹{item.total_deductions?.toLocaleString() || '0'}
                      </Text>
                    </View>
                    {item.attendance_deduction > 0 && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordLabel}>Attendance Deduction:</Text>
                        <Text style={[styles.recordValue, styles.deductionValue]}>
                          ₹{item.attendance_deduction?.toLocaleString() || '0'}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.recordRow, styles.netSalaryRow]}>
                      <Text style={styles.netLabel}>Net Salary:</Text>
                      <Text style={styles.netValue}>₹{item.net_salary?.toLocaleString() || '0'}</Text>
                    </View>
                    {item.payment_date && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordLabel}>Payment Date:</Text>
                        <Text style={styles.recordValue}>
                          {new Date(item.payment_date).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                    {item.payment_mode && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordLabel}>Payment Mode:</Text>
                        <Text style={styles.recordValue}>
                          {(item.payment_mode || '').toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {item.status === 'rejected' && item.rejection_reason && (
                      <View style={styles.rejectionReason}>
                        <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                        <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
                      </View>
                    )}
                    {item.status === 'paid' && (
                      <TouchableOpacity
                        style={styles.viewSlipButton}
                        onPress={() => {
                          setSelectedRecord(item);
                          Alert.alert(
                            'Salary Slip',
                            `Month: ${new Date(2000, item.month - 1).toLocaleString('default', { month: 'long' })} ${item.year}\n\n` +
                            `Gross Salary: ₹${item.gross_salary?.toLocaleString() || '0'}\n` +
                            `Total Deductions: ₹${item.total_deductions?.toLocaleString() || '0'}\n` +
                            (item.attendance_deduction > 0 ? `Attendance Deduction: ₹${item.attendance_deduction?.toLocaleString() || '0'}\n` : '') +
                            `Net Salary: ₹${item.net_salary?.toLocaleString() || '0'}\n\n` +
                            (item.payment_date ? `Payment Date: ${new Date(item.payment_date).toLocaleDateString()}\n` : '') +
                            (item.payment_mode ? `Payment Mode: ${(item.payment_mode || '').toUpperCase()}` : ''),
                            [{ text: 'OK' }]
                          );
                        }}
                      >
                        <Text style={styles.viewSlipText}>View Slip</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </Card>
      </ScrollView>

      {/* Payment History Modal - Placeholder for now */}
      {showPaymentHistory && (
        <Modal
          visible={showPaymentHistory}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowPaymentHistory(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment History</Text>
              <TouchableOpacity onPress={() => setShowPaymentHistory(false)}>
                <Text style={styles.closeButton}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalMessage}>
                Payment history feature coming soon. For now, you can view payment details in individual salary records above.
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1 },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  historyButton: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  historyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  structureCard: { margin: 16, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  structureGrid: { gap: 12 },
  structureItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  structureLabel: { fontSize: 14, color: '#64748b' },
  structureValue: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  deductionValue: { color: '#ef4444' },
  grossSalaryItem: { marginTop: 8, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#e2e8f0', borderBottomWidth: 0 },
  grossLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  grossValue: { fontSize: 24, fontWeight: '700', color: '#10b981' },
  noStructure: { textAlign: 'center', color: '#64748b', paddingVertical: 16 },
  recordsCard: { margin: 16, marginTop: 0, padding: 16 },
  recordItem: { marginBottom: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recordMonth: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1f5f9' },
  statusPaid: { backgroundColor: '#dcfce7' },
  statusApproved: { backgroundColor: '#dbeafe' },
  statusPending: { backgroundColor: '#fef3c7' },
  statusRejected: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'capitalize' },
  statusTextPaid: { color: '#166534' },
  statusTextApproved: { color: '#1e40af' },
  statusTextPending: { color: '#92400e' },
  statusTextRejected: { color: '#991b1b' },
  recordDetails: { gap: 8 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordLabel: { fontSize: 14, color: '#64748b' },
  recordValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  netSalaryRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  netLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  netValue: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  rejectionReason: { marginTop: 8, padding: 12, backgroundColor: '#fee2e2', borderRadius: 8 },
  rejectionLabel: { fontSize: 12, fontWeight: '600', color: '#991b1b', marginBottom: 4 },
  rejectionText: { fontSize: 12, color: '#991b1b' },
  viewSlipButton: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#2563eb', borderRadius: 8, alignSelf: 'flex-start' },
  viewSlipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  closeButton: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  modalContent: { flex: 1, padding: 16 },
  modalMessage: { fontSize: 16, color: '#64748b', lineHeight: 24 },
});
