import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { StudentScreenWrapper } from '../../../shared/components/StudentScreenWrapper';
import { useStudentFees } from '../hooks/useFees';

export function MyFeesScreen() {
  const { data, isLoading, refetch, isRefetching } = useStudentFees();
  const summary = data?.summary;
  const bills = data?.bills || [];
  const payments = data?.payments || [];

  return (
    <StudentScreenWrapper currentRoute="MyFees">
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <Text style={styles.title}>Fees & Payments</Text>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.totalCard]}>
            <Text style={styles.summaryLabel}>Total Fee</Text>
            <Text style={[styles.summaryValue, styles.totalValue]}>
              ₹{summary?.total_fee?.toFixed(2) || '0.00'}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.paidCard]}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, styles.paidValue]}>
              ₹{summary?.paid_amount?.toFixed(2) || '0.00'}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.pendingCard]}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, styles.pendingValue]}>
              ₹{summary?.pending_amount?.toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>

        {/* Bills Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bills</Text>
          {bills.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No bills found.</Text>
            </View>
          ) : (
            bills.map((bill) => (
              <View key={bill.id} style={styles.billCard}>
                <View style={styles.billHeader}>
                  <Text style={styles.billNumber}>Bill No: {bill.bill_no}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      bill.status === 'paid' && styles.statusPaid,
                      bill.status === 'partial' && styles.statusPartial,
                      bill.status === 'pending' && styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        bill.status === 'paid' && styles.statusTextPaid,
                        bill.status === 'partial' && styles.statusTextPartial,
                        bill.status === 'pending' && styles.statusTextPending,
                      ]}
                    >
                      {bill.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.billAmount}>₹{bill.total_amount.toFixed(2)}</Text>
                <Text style={styles.billDueDate}>
                  Due: {new Date(bill.due_date).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Payment History Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {payments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No payment records found.</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentDate}>
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.paymentAmount}>₹{payment.amount.toFixed(2)}</Text>
                </View>
                <Text style={styles.paymentMethod}>
                  Method: {payment.method.replace('-', ' ').toUpperCase()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </StudentScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  totalCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  paidCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  pendingCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  totalValue: {
    color: '#2563eb',
  },
  paidValue: {
    color: '#10b981',
  },
  pendingValue: {
    color: '#ef4444',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  billCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  statusPaid: {
    backgroundColor: '#dcfce7',
  },
  statusPartial: {
    backgroundColor: '#fef3c7',
  },
  statusPending: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusTextPaid: {
    color: '#166534',
  },
  statusTextPartial: {
    color: '#92400e',
  },
  statusTextPending: {
    color: '#991b1b',
  },
  billAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  billDueDate: {
    fontSize: 14,
    color: '#64748b',
  },
  paymentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  paymentMethod: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
  },
});
