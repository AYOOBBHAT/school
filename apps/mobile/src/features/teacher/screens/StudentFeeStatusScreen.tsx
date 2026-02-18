import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudentsForFeeStatus } from '../hooks/useStudentsForFeeStatus';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { TeacherStackScreenProps } from '../../../navigation/types';
import type { StudentForFeeStatus } from '../../../shared/services/teacher.service';

type Props = TeacherStackScreenProps<'StudentFeeStatus'>;

export function StudentFeeStatusScreen({ navigation }: Props) {
  const { data, isLoading, refetch, isRefetching } = useStudentsForFeeStatus();
  const students = data?.students ?? [];

  if (isLoading) {
    return <LoadingSpinner message="Loading students..." fullScreen />;
  }

  const displayName = (s: StudentForFeeStatus) =>
    s.profile?.full_name ?? s.profiles?.full_name ?? '—';
  const displayRoll = (s: StudentForFeeStatus) => s.roll_number ?? '—';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Student Fee Status (Read-Only)</Text>
        <Text style={styles.subtitle}>
          View students in your assigned classes. Fee details are managed by the office. You cannot modify fees.
        </Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={students.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="No students found"
            message="No students in your assigned classes yet"
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.studentCard}>
            <View style={styles.studentRow}>
              <Text style={styles.rollNumber}>{displayRoll(item)}</Text>
              <Text style={styles.studentName}>{displayName(item)}</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Fee status:</Text>
              <Text style={styles.feeValue}>—</Text>
            </View>
            {item.class_groups?.name && (
              <Text style={styles.className}>Class: {item.class_groups.name}</Text>
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
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  studentCard: { marginBottom: 12, padding: 16 },
  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rollNumber: { fontSize: 14, color: '#64748b', marginRight: 12, minWidth: 60 },
  studentName: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },
  feeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  feeLabel: { fontSize: 13, color: '#64748b', marginRight: 8 },
  feeValue: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  className: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
