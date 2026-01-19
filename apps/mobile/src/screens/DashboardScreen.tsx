import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../navigation/AuthContext';
import { api } from '../services/api';
import { authService } from '../services/auth';
import { DashboardStats } from '../types';
import { UnpaidFeeAnalytics } from '../components/UnpaidFeeAnalytics';
import { UnpaidSalaries } from '../components/UnpaidSalaries';

export function DashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only load dashboard after user is confirmed (avoid race condition with auth loading)
    if (user) {
      loadDashboard();
    }
  }, [user]);

  const loadDashboard = async () => {
    // Don't load if we don't have a user
    if (!user) {
      setLoading(false);
      return;
    }

    // Ensure token is loaded from storage before making request
    try {
      const authLoaded = await authService.loadStoredAuth();
      if (!authLoaded) {
        console.warn('[DashboardScreen] No stored auth found, but user is set. This may cause authentication errors.');
      }
      
      // Verify token is set in API service
      // We can't directly access the token, but we can verify by checking if loadStoredAuth succeeded
      if (__DEV__) {
        console.log('[DashboardScreen] Auth loaded, proceeding with dashboard request');
      }
    } catch (error) {
      console.error('[DashboardScreen] Error loading stored auth:', error);
      // Don't proceed if we can't load auth
      return;
    }

    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      // If it's an auth error (missing token, bearer token, authentication required), log the user out
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('authentication') || 
          errorMsg.includes('bearer') || 
          errorMsg.includes('missing bearer token') ||
          errorMsg.includes('token')) {
        console.log('Authentication error detected, logging out...');
        await logout();
      }
    } finally {
      setLoading(false);
    }
  };

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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboard} />}
      >
        <View style={styles.statsGrid}>
          {user?.role === 'principal' && (
            <>
              <StatCard title="Total Students" value={stats.total_students} />
              <StatCard title="Total Teachers" value={stats.total_teachers} />
              <StatCard title="Total Classes" value={stats.total_classes} />
              <StatCard title="Pending Approvals" value={stats.pending_approvals} />
            </>
          )}
          {user?.role === 'teacher' && (
            <>
              <StatCard title="Today's Attendance" value={stats.today_attendance} />
              <StatCard title="My Classes" value={stats.total_classes} />
            </>
          )}
          {user?.role === 'student' && (
            <>
              <StatCard title="My Classes" value={stats.total_classes} />
            </>
          )}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {user?.role === 'principal' && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Students')}>
                <Text style={styles.actionText}>Manage Students</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Classes')}>
                <Text style={styles.actionText}>Manage Classes</Text>
              </TouchableOpacity>
            </>
          )}

          {user?.role === 'teacher' && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Attendance')}>
                <Text style={styles.actionText}>Mark Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Marks')}>
                <Text style={styles.actionText}>Enter Marks</Text>
              </TouchableOpacity>
            </>
          )}

          {user?.role === 'student' && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyAttendance')}>
                <Text style={styles.actionText}>My Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyMarks')}>
                <Text style={styles.actionText}>My Marks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyFees')}>
                <Text style={styles.actionText}>My Fees</Text>
              </TouchableOpacity>
            </>
          )}

          {user?.role === 'clerk' && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Fees')}>
                <Text style={styles.actionText}>Manage Fees</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Payments')}>
                <Text style={styles.actionText}>View Payments</Text>
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

