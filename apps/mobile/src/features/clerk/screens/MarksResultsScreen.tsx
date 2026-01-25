import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerkClasses } from '../hooks/useFeeCollection';
import { useClerkExams, useMarksResults } from '../hooks/useMarksResults';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ClassGroup, NavigationProp } from '../../../shared/types';

interface MarksResultsScreenProps {
  navigation: NavigationProp;
}

export function MarksResultsScreen({ navigation }: MarksResultsScreenProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<string>('');

  const { data: classesData } = useClerkClasses();
  const { data: examsData } = useClerkExams();
  const { data: resultsData, isLoading, refetch, isRefetching } = useMarksResults(
    {
      class_group_id: selectedClass || undefined,
      exam_id: selectedExam || undefined,
    },
    true
  );

  const classes = classesData?.classes || [];
  const exams = examsData?.exams || [];
  const results = resultsData?.results || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading results..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marks & Results</Text>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedClass && styles.filterChipActive]}
            onPress={() => setSelectedClass('')}
          >
            <Text style={[styles.filterChipText, !selectedClass && styles.filterChipTextActive]}>All Classes</Text>
          </TouchableOpacity>
          {classes.map(cls => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.filterChip, selectedClass === cls.id && styles.filterChipActive]}
              onPress={() => setSelectedClass(cls.id)}
            >
              <Text style={[styles.filterChipText, selectedClass === cls.id && styles.filterChipTextActive]}>
                {cls.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedExam && styles.filterChipActive]}
            onPress={() => setSelectedExam('')}
          >
            <Text style={[styles.filterChipText, !selectedExam && styles.filterChipTextActive]}>All Exams</Text>
          </TouchableOpacity>
          {exams.map(exam => (
            <TouchableOpacity
              key={exam.id}
              style={[styles.filterChip, selectedExam === exam.id && styles.filterChipActive]}
              onPress={() => setSelectedExam(exam.id)}
            >
              <Text style={[styles.filterChipText, selectedExam === exam.id && styles.filterChipTextActive]}>
                {exam.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item, index) => item.id || `result-${index}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="📊" title="No results found" message="Try adjusting filters" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>
              {item.students?.profiles?.full_name || 'Unknown'} - {item.subjects?.name || 'N/A'}
            </Text>
            <Text style={styles.cardEmail}>
              Exam: {item.exams?.name || 'N/A'} | Class: {item.students?.class_groups?.name || 'N/A'}
            </Text>
            <Text style={styles.marksText}>
              Marks: {item.marks_obtained || 0} / {item.max_marks || 0} ({item.max_marks > 0 ? ((item.marks_obtained / item.max_marks) * 100).toFixed(1) : '0'}%)
            </Text>
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
  filters: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterRow: { marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 8 },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  marksText: { fontSize: 16, fontWeight: '600', color: '#10b981', marginTop: 8 },
});
