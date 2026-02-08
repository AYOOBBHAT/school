import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeacherAssignments } from '../hooks/useTeacherAssignments';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useAuth } from '../../../navigation/AuthContext';
import { NavigationProp } from '../../../shared/types';

interface StudentFeeStatusScreenProps {
  navigation: NavigationProp;
}

export function StudentFeeStatusScreen({ navigation }: StudentFeeStatusScreenProps) {
  const { user } = useAuth();
  const { data: assignmentsData, isLoading, refetch, isRefetching } = useTeacherAssignments(user?.id || '');
  const assignments = assignmentsData?.assignments || [];

  // For now, this is a placeholder. In a full implementation, we would:
  // 1. Load all students from assigned classes
  // 2. Load fee status for each student
  // 3. Display in a table format

  if (isLoading) {
    return <LoadingSpinner message="Loading..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Student Fee Status (Read-Only)</Text>
        <Text style={styles.subtitle}>
          View fee status for students in your assigned classes. You cannot modify fees.
        </Text>
      </View>

      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
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
            <Text style={styles.infoText}>
              Fee status view for students in this class will be available soon.
            </Text>
            <Text style={styles.noteText}>
              Note: This is a read-only view. You cannot modify student fees.
            </Text>
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
  classCard: { marginBottom: 12, padding: 16 },
  className: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sectionName: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
  noteText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
