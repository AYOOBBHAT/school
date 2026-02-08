import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudentAttendance } from '../hooks/useAttendance';

export function MyAttendanceScreen() {
  const { data, isLoading, refetch, isRefetching } = useStudentAttendance();
  const attendance = data?.attendance || [];
  const summary = data?.summary;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Attendance</Text>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Days</Text>
            <Text style={styles.summaryValue}>{summary.totalDays}</Text>
          </View>
          <View style={[styles.summaryCard, styles.presentCard]}>
            <Text style={styles.summaryLabel}>Present</Text>
            <Text style={[styles.summaryValue, styles.presentValue]}>{summary.presentDays}</Text>
          </View>
          <View style={[styles.summaryCard, styles.absentCard]}>
            <Text style={styles.summaryLabel}>Absent</Text>
            <Text style={[styles.summaryValue, styles.absentValue]}>{summary.absentDays}</Text>
          </View>
          <View style={[styles.summaryCard, styles.percentageCard]}>
            <Text style={styles.summaryLabel}>Percentage</Text>
            <Text style={[styles.summaryValue, styles.percentageValue]}>
              {summary.attendancePercentage.toFixed(1)}%
            </Text>
          </View>
        </View>
      )}

      {/* Attendance Records */}
      <FlatList
        data={attendance}
        keyExtractor={(item, index) => item.id || `attendance-${index}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'present' && styles.statusPresent,
                  item.status === 'absent' && styles.statusAbsent,
                  item.status === 'late' && styles.statusLate,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    item.status === 'present' && styles.statusTextPresent,
                    item.status === 'absent' && styles.statusTextAbsent,
                    item.status === 'late' && styles.statusTextLate,
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? 'Loading attendance...' : 'No attendance records yet.'}
          </Text>
        }
        contentContainerStyle={attendance.length === 0 ? styles.emptyContainer : undefined}
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
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
  presentCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  absentCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  percentageCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde047',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  presentValue: {
    color: '#10b981',
  },
  absentValue: {
    color: '#ef4444',
  },
  percentageValue: {
    color: '#f59e0b',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  statusPresent: {
    backgroundColor: '#dcfce7',
  },
  statusAbsent: {
    backgroundColor: '#fee2e2',
  },
  statusLate: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statusTextPresent: {
    color: '#166534',
  },
  statusTextAbsent: {
    color: '#991b1b',
  },
  statusTextLate: {
    color: '#92400e',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 32,
    fontSize: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 64,
  },
});
