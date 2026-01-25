import React from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeacherSalary } from '../hooks/useTeacherSalary';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { NavigationProp } from '../../../shared/types';

interface MySalaryScreenProps {
  navigation: NavigationProp;
}

export function MySalaryScreen({ navigation }: MySalaryScreenProps) {
  const { data: salaryData, isLoading, refetch, isRefetching } = useTeacherSalary();
  const salaryRecords = salaryData?.records || [];

  if (isLoading) {
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={salaryRecords.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState icon="💰" title="No salary records" message="Salary records will appear here once generated" />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>
              {new Date(2000, item.month - 1).toLocaleString('default', { month: 'long' })} {item.year}
            </Text>
            <Text style={styles.cardEmail}>Gross: ₹{(item.gross_salary || item.base_salary + item.allowances || 0).toLocaleString()}</Text>
            <Text style={styles.cardEmail}>Net: ₹{item.net_salary.toLocaleString()}</Text>
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
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  statusBadge: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
