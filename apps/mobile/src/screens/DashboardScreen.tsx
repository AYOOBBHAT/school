import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../navigation/AuthContext';
import { useDashboard } from '../features/principal/hooks/useDashboard';
import { DashboardStats } from '../shared/types';
import { UnpaidFeeAnalytics } from '../shared/components/UnpaidFeeAnalytics';
import { UnpaidSalaries } from '../shared/components/UnpaidSalaries';

import { NavigationProp } from '../shared/types';

interface DashboardScreenProps {
  navigation: NavigationProp;
}

export function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { user, logout } = useAuth();
  const { data: stats = {} as DashboardStats, isLoading, refetch, isRefetching } = useDashboard();

  const StatCard = ({ title, value }: { title: string; value?: number }) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.role}>{user?.role}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <View style={styles.statsGrid}>
          {user?.role === 'principal' && (
            <>
              <StatCard title="Total Students" value={stats.total_students ?? undefined} />
              <StatCard title="Total Teachers" value={stats.total_teachers ?? undefined} />
              <StatCard title="Total Classes" value={stats.total_classes ?? undefined} />
              <StatCard title="Pending Approvals" value={stats.pending_approvals ?? undefined} />
            </>
          )}
          {user?.role === 'teacher' && (
            <>
              <StatCard title="Today's Attendance" value={stats.today_attendance ?? undefined} />
              <StatCard title="My Classes" value={stats.total_classes ?? undefined} />
            </>
          )}
          {user?.role === 'student' && (
            <>
              <StatCard title="My Classes" value={stats.total_classes ?? undefined} />
            </>
          )}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {user?.role === 'principal' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Dashboard' })}
              >
                <Text style={styles.actionText}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Students' })}
              >
                <Text style={styles.actionText}>Manage Students</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Classes' })}
              >
                <Text style={styles.actionText}>Manage Classes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Staff' })}
              >
                <Text style={styles.actionText}>Manage Staff</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Subjects' })}
              >
                <Text style={styles.actionText}>Manage Subjects</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Exams' })}
              >
                <Text style={styles.actionText}>Manage Exams</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Salary' })}
              >
                <Text style={styles.actionText}>Salary Management</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Fees' })}
              >
                <Text style={styles.actionText}>Fee Management</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Principal', { screen: 'Classifications' })}
              >
                <Text style={styles.actionText}>Classifications</Text>
              </TouchableOpacity>
            </>
          )}

          {user?.role === 'teacher' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Teacher', { screen: 'MyClasses' })}
              >
                <Text style={styles.actionText}>My Classes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Teacher', { screen: 'MarkAttendance' })}
              >
                <Text style={styles.actionText}>Mark Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Teacher', { screen: 'EnterMarks' })}
              >
                <Text style={styles.actionText}>Enter Marks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Teacher', { screen: 'MySalary' })}
              >
                <Text style={styles.actionText}>My Salary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Teacher', { screen: 'StudentFeeStatus' })}
              >
                <Text style={styles.actionText}>Student Fee Status</Text>
              </TouchableOpacity>
            </>
          )}

          {user?.role === 'student' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Student', { screen: 'Overview' })}
              >
                <Text style={styles.actionText}>Overview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Student', { screen: 'MyAttendance' })}
              >
                <Text style={styles.actionText}>My Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Student', { screen: 'MyMarks' })}
              >
                <Text style={styles.actionText}>My Marks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Student', { screen: 'MyFees' })}
              >
                <Text style={styles.actionText}>My Fees</Text>
              </TouchableOpacity>
            </>
          )}

          {user?.role === 'clerk' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Clerk', { screen: 'Dashboard' })}
              >
                <Text style={styles.actionText}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Clerk', { screen: 'FeeCollection' })}
              >
                <Text style={styles.actionText}>Collect Fees</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Clerk', { screen: 'SalaryPayment' })}
              >
                <Text style={styles.actionText}>Pay Salary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Clerk', { screen: 'MarksResults' })}
              >
                <Text style={styles.actionText}>Marks & Results</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Unpaid Fee Analytics - Only for Principal */}
        {user?.role === 'principal' && (
          <View style={styles.analyticsSection}>
            <UnpaidFeeAnalytics userRole="principal" />
          </View>
        )}

        {/* Unpaid Salaries - Only for Principal */}
        {user?.role === 'principal' && (
          <View style={styles.analyticsSection}>
            <UnpaidSalaries userRole="principal" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  role: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#64748b',
  },
  quickActions: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  analyticsSection: {
    marginTop: 8,
  },
});

