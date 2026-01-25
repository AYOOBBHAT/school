import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudentMarks } from '../hooks/useMarks';
import { Mark } from '../../../shared/types';

export function MyMarksScreen() {
  const { data: marksData, isLoading, refetch, isRefetching } = useStudentMarks({});
  const marks = marksData?.marks || [];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Marks</Text>
      <FlatList
        data={marks}
        keyExtractor={(item, index) => item.id || `mark-${index}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
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
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 32,
  },
});
