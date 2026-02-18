import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeacherAssignments } from '../hooks/useTeacherAssignments';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useAuth } from '../../../navigation/AuthContext';
import { Assignment } from '../../../shared/types';
import type { TeacherStackScreenProps } from '../../../navigation/types';

type Props = TeacherStackScreenProps<'MyClasses'>;

// Same as web sidebar: My Classes, Attendance, Marks Entry, My Salary (no Student Fees - web has it hidden)
const TEACHER_MENU_ITEMS: { screen: 'MarkAttendance' | 'EnterMarks' | 'MySalary'; label: string; icon: string }[] = [
  { screen: 'MarkAttendance', label: 'Attendance', icon: '📅' },
  { screen: 'EnterMarks', label: 'Marks Entry', icon: '📊' },
  { screen: 'MySalary', label: 'My Salary', icon: '💰' },
];

export function MyClassesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { data: assignmentsData, isLoading, refetch, isRefetching } = useTeacherAssignments(user?.id || '');
  const assignments = assignmentsData?.assignments || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading classes..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Teacher menu – same as web sidebar so all features are visible */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Teacher</Text>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemActive]} onPress={() => {}}>
            <Text style={styles.menuIcon}>📚</Text>
            <Text style={[styles.menuItemText, styles.menuItemTextActive]}>My Classes</Text>
          </TouchableOpacity>
          {TEACHER_MENU_ITEMS.map(({ screen, label, icon }) => (
            <TouchableOpacity
              key={screen}
              style={styles.menuItem}
              onPress={() => (navigation as any).navigate(screen)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{icon}</Text>
              <Text style={styles.menuItemText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>My Classes & Subjects</Text>
        </View>

        {assignments.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="📚"
              title="No classes assigned"
              message="Contact your principal to assign you to classes"
            />
          </View>
        ) : (
          <FlatList
        scrollEnabled={false}
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  menuSection: { backgroundColor: '#1e293b', padding: 16, marginBottom: 16 },
  menuTitle: { fontSize: 14, color: '#94a3b8', marginBottom: 12, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  menuItemActive: { backgroundColor: '#2563eb' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuItemText: { fontSize: 16, color: '#e2e8f0', fontWeight: '500' },
  menuItemTextActive: { color: '#fff', fontWeight: '600' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  emptyWrapper: { padding: 24, minHeight: 200 },
  classCard: { marginBottom: 12, padding: 16 },
  className: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sectionName: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  subjectName: { fontSize: 16, fontWeight: '600', color: '#2563eb', marginTop: 8 },
  description: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
