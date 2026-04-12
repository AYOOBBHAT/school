import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { StudentScreenWrapper } from '../../../shared/components/StudentScreenWrapper';
import { useStudentFees } from '../hooks/useFees';
import { useStudentMonthlyFeeLedger } from '../hooks/useStudentMonthlyLedger';
import type { MonthLedgerSummary } from '../../../shared/utils/monthlyFeeLedger';

function statusLabel(status: MonthLedgerSummary['monthStatus']): string {
  if (status === 'partially-paid') return 'Partially paid';
  if (status === 'paid') return 'Paid';
  return 'Unpaid';
}

export function MyFeesScreen() {
  const { data, isLoading, refetch, isRefetching } = useStudentFees();
  const ledgerQuery = useStudentMonthlyFeeLedger();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const summary = data?.summary;
  const bills = data?.bills || [];
  const payments = data?.payments || [];
  const months = ledgerQuery.data?.months ?? [];
  const rpcSummary = ledgerQuery.data?.rpcSummary;

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const refreshing = isRefetching || ledgerQuery.isRefetching;
  const onRefresh = () => {
    refetch();
    ledgerQuery.refetch();
  };

  const loadingAny = isLoading || ledgerQuery.isLoading;

  return (
    <StudentScreenWrapper currentRoute="MyFees">
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Fees & Payments</Text>

        {ledgerQuery.isError && (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>
              Monthly fee status could not be loaded. Pull to retry.
            </Text>
          </View>
        )}

        {rpcSummary ? (
          <View style={styles.rpcSummaryRow}>
            <View style={styles.rpcChip}>
              <Text style={styles.rpcChipLabel}>Total fee</Text>
              <Text style={styles.rpcChipValue}>₹{Number(rpcSummary.total_fee_amount ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.rpcChip}>
              <Text style={styles.rpcChipLabel}>Paid</Text>
              <Text style={[styles.rpcChipValue, styles.rpcPaid]}>₹{Number(rpcSummary.total_paid_amount ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.rpcChip}>
              <Text style={styles.rpcChipLabel}>Pending</Text>
              <Text style={[styles.rpcChipValue, styles.rpcPending]}>₹{Number(rpcSummary.total_pending_amount ?? 0).toFixed(2)}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Monthly fee status</Text>
        {loadingAny && months.length === 0 ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : months.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No monthly fee records yet.</Text>
          </View>
        ) : (
          months.map((m, idx) => {
            const key = `${m.year ?? ''}-${m.monthNumber ?? idx}`;
            const open = expanded.has(key);
            const badgeStyle =
              m.monthStatus === 'paid'
                ? styles.badgePaid
                : m.monthStatus === 'partially-paid'
                  ? styles.badgePartial
                  : styles.badgeUnpaid;
            return (
              <View key={key} style={styles.monthCard}>
                <TouchableOpacity onPress={() => toggle(key)} style={styles.monthHeader}>
                  <View style={styles.monthHeaderLeft}>
                    <Text style={styles.monthTitle}>{m.monthLabel || 'Month'}</Text>
                    <View style={[styles.badge, badgeStyle]}>
                      <Text style={styles.badgeText}>{statusLabel(m.monthStatus)}</Text>
                    </View>
                  </View>
                  <Text style={styles.chevron}>{open ? '▼' : '▶'}</Text>
                </TouchableOpacity>
                <View style={styles.monthTotals}>
                  <Text style={styles.totalLine}>Fee ₹{m.totalFee.toFixed(2)}</Text>
                  <Text style={styles.totalLine}>Paid ₹{m.totalPaid.toFixed(2)}</Text>
                  <Text style={styles.totalLine}>Pending ₹{m.totalPending.toFixed(2)}</Text>
                </View>
                {open &&
                  m.components.map((c) => (
                    <View key={c.id ?? `${c.fee_name}`} style={styles.compRow}>
                      <Text style={styles.compName}>{c.fee_name}</Text>
                      <Text style={styles.compMeta} numberOfLines={1}>
                        ₹{Number(c.fee_amount ?? 0).toFixed(2)} · paid ₹{Number(c.paid_amount ?? 0).toFixed(2)} · pend. ₹
                        {Number(c.pending_amount ?? 0).toFixed(2)}
                      </Text>
                      <Text style={styles.compStatus}>{c.status ?? '—'}</Text>
                    </View>
                  ))}
              </View>
            );
          })
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpacer]}>Summary (bills)</Text>
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
                <Text style={styles.billDueDate}>Due: {new Date(bill.due_date).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment history (bills)</Text>
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
  content: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  warnBanner: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  warnText: { color: '#92400e', fontSize: 13 },
  rpcSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  rpcChip: {
    flexGrow: 1,
    minWidth: '28%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rpcChipLabel: { fontSize: 11, color: '#64748b' },
  rpcChipValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  rpcPaid: { color: '#15803d' },
  rpcPending: { color: '#b91c1c' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  sectionSpacer: { marginTop: 20 },
  muted: { color: '#64748b', marginBottom: 12 },
  monthCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  chevron: { color: '#94a3b8', fontSize: 12, marginLeft: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgePaid: { backgroundColor: '#d1fae5' },
  badgePartial: { backgroundColor: '#fef3c7' },
  badgeUnpaid: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  monthTotals: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 12, paddingBottom: 8 },
  totalLine: { fontSize: 13, color: '#475569' },
  compRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  compName: { fontWeight: '600', color: '#1e293b' },
  compMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  compStatus: { fontSize: 12, color: '#334155', marginTop: 4, textTransform: 'capitalize' },
  summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, minWidth: '28%', borderRadius: 12, padding: 14 },
  totalCard: { backgroundColor: '#eff6ff' },
  paidCard: { backgroundColor: '#ecfdf5' },
  pendingCard: { backgroundColor: '#fef2f2' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  totalValue: { color: '#1d4ed8' },
  paidValue: { color: '#15803d' },
  pendingValue: { color: '#b91c1c' },
  section: { marginBottom: 24 },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { color: '#64748b' },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billNumber: { fontWeight: '600', color: '#0f172a' },
  billAmount: { fontSize: 18, fontWeight: '700', marginTop: 8, color: '#1e293b' },
  billDueDate: { fontSize: 13, color: '#64748b', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusPaid: { backgroundColor: '#d1fae5' },
  statusPartial: { backgroundColor: '#fef9c3' },
  statusPending: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusTextPaid: { color: '#166534' },
  statusTextPartial: { color: '#a16207' },
  statusTextPending: { color: '#991b1b' },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentDate: { color: '#475569' },
  paymentAmount: { fontWeight: '700', color: '#15803d' },
  paymentMethod: { fontSize: 12, color: '#64748b', marginTop: 6 },
});
