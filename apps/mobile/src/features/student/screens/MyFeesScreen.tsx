import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudentFees } from '../hooks/useFees';
import { Fee } from '../../../shared/types';

export function MyFeesScreen() {
  const { data: feesData, isLoading, refetch, isRefetching } = useStudentFees({});
  const fees = feesData?.fees || [];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Fees</Text>
      <FlatList
        data={fees}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.billNumber}>Bill: {item.bill_number}</Text>
            <Text style={styles.amount}>₹{item.total_amount}</Text>
            <Text style={[styles.status, styles[item.status]]}>{item.status}</Text>
            <Text style={styles.dueDate}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No fees records</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  dueDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 32,
  },
  paid: {
    color: '#10b981',
  },
  pending: {
    color: '#f59e0b',
  },
  overdue: {
    color: '#ef4444',
  },
  partial: {
    color: '#6366f1',
  },
});
