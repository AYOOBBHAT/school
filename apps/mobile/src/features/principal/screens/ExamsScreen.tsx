import React from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExams } from '../hooks/useExams';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Exam, NavigationProp } from '../../../shared/types';

interface ExamsScreenProps {
  navigation: NavigationProp;
}

export function ExamsScreen({ navigation }: ExamsScreenProps) {
  const { data: examsData, isLoading, refetch, isRefetching } = useExams();
  const exams = examsData?.exams || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading exams..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exams</Text>
      </View>

      <FlatList
        data={exams}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={exams.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="📝" title="No exams found" message="Create your first exam" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardEmail}>Term: {item.term}</Text>
            <Text style={styles.cardEmail}>
              {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
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
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  cardEmail: { fontSize: 14, color: '#64748b', marginBottom: 2 },
});
