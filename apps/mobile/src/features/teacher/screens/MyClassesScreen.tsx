import React from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeacherAssignments } from '../hooks/useTeacherAssignments';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useAuth } from '../../../navigation/AuthContext';
import { Assignment, NavigationProp } from '../../../shared/types';

interface MyClassesScreenProps {
  navigation: NavigationProp;
}

export function MyClassesScreen({ navigation }: MyClassesScreenProps) {
  const { user } = useAuth();
  const { data: assignmentsData, isLoading, refetch, isRefetching } = useTeacherAssignments(user?.id || '');
  const assignments = assignmentsData?.assignments || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading classes..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classes & Subjects</Text>
      </View>

      <FlatList
        data={assignments}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={assignments.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="No classes assigned"
            message="Contact your principal to assign you to classes"
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.classCard}>
            <Text style={styles.className}>{item.class_groups?.name || 'Unknown Class'}</Text>
            {item.sections && (
              <Text style={styles.sectionName}>Section: {item.sections.name}</Text>
            )}
            <Text style={styles.subjectName}>
              {item.subjects?.name || 'Unknown Subject'}
              {item.subjects?.code && ` (${item.subjects.code})`}
            </Text>
            {item.class_groups?.description && (
              <Text style={styles.description}>{item.class_groups.description}</Text>
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
  classCard: { marginBottom: 12, padding: 16 },
  className: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sectionName: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  subjectName: { fontSize: 16, fontWeight: '600', color: '#2563eb', marginTop: 8 },
  description: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
