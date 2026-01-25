import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudentAttendance } from '../hooks/useAttendance';
import { Attendance } from '../../../shared/types';

export function MyAttendanceScreen() {
  const { data: attendanceData, isLoading, refetch, isRefetching } = useStudentAttendance({});
  const attendance = attendanceData?.attendance || [];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Attendance</Text>
      <FlatList
        data={attendance}
        keyExtractor={(item, index) => item.id || `attendance-${index}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
            <Text style={[styles.status, styles[item.status]]}>{item.status}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No attendance records</Text>}
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
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  present: {
    color: '#10b981',
  },
  absent: {
    color: '#ef4444',
  },
  late: {
    color: '#f59e0b',
  },
  excused: {
    color: '#6366f1',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 32,
  },
});
