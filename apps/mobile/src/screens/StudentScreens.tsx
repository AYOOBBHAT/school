import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { Student, Attendance, Mark, Fee } from '../types';

export function MyAttendanceScreen() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async () => {
    try {
      const response = await api.getAttendance({});
      setAttendance(response.attendance);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Attendance</Text>
      <FlatList
        data={attendance}
        keyExtractor={(item, index) => item.id || `attendance-${index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAttendance} />}
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

export function MyMarksScreen() {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarks();
  }, []);

  const loadMarks = async () => {
    try {
      const response = await api.getMarks({});
      setMarks(response.marks);
    } catch (error) {
      console.error('Error loading marks:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Marks</Text>
      <FlatList
        data={marks}
        keyExtractor={(item, index) => item.id || `mark-${index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMarks} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.subject}>Subject ID: {item.subject_id}</Text>
            <Text style={styles.marks}>
              {item.marks_obtained} / {item.max_marks}
            </Text>
            <Text style={styles.percentage}>
              {((item.marks_obtained / item.max_marks) * 100).toFixed(1)}%
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No marks available</Text>}
      />
    </SafeAreaView>
  );
}

export function MyFeesScreen() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = async () => {
    try {
      const response = await api.getFees({});
      setFees(response.fees);
    } catch (error) {
      console.error('Error loading fees:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Fees</Text>
      <FlatList
        data={fees}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFees} />}
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
  subject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  marks: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  percentage: {
    fontSize: 14,
    color: '#64748b',
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

