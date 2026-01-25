import React from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSalarySummary } from '../hooks/useSalary';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { NavigationProp } from '../../../shared/types';

interface SalaryScreenProps {
  navigation: NavigationProp;
}

export function SalaryScreen({ navigation }: SalaryScreenProps) {
  const { data: salaryData, isLoading, refetch, isRefetching } = useSalarySummary();
  const summaries = salaryData?.summary?.summaries || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading salary data..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Salary Management</Text>
      </View>

      <FlatList
        data={summaries}
        keyExtractor={(item, index) => `salary-${item.month}-${item.year}-${index}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={summaries.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="💰" title="No salary data found" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>
              {new Date(2000, item.month - 1).toLocaleString('default', { month: 'long' })} {item.year}
            </Text>
            <Text style={styles.cardEmail}>Paid: ₹{item.paid.toLocaleString()}</Text>
            <Text style={styles.cardEmail}>Pending: ₹{item.pending.toLocaleString()}</Text>
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
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 2 },
});
