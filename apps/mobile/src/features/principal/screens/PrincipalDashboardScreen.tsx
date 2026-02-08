import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { loadSchoolInfo, loadDashboardStats, SchoolInfo, DashboardStats } from '../../../shared/services/principal.service';
import { queryKeys } from '../../../shared/queryKeys';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { NavigationProp } from '../../../shared/types';

interface PrincipalDashboardScreenProps {
  navigation: NavigationProp;
}

export function PrincipalDashboardScreen({ navigation }: PrincipalDashboardScreenProps) {
  const { data: schoolInfo, isLoading: loadingSchool, refetch: refetchSchool, isRefetching: refetchingSchool } = useQuery({
    queryKey: ['principal', 'schoolInfo'],
    queryFn: loadSchoolInfo,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  const { data: stats, isLoading: loadingStats, refetch: refetchStats, isRefetching: refetchingStats } = useQuery({
    queryKey: queryKeys.principal.dashboard,
    queryFn: loadDashboardStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const isLoading = loadingSchool || loadingStats;
  const isRefetching = refetchingSchool || refetchingStats;

  const handleRefresh = () => {
    refetchSchool();
    refetchStats();
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        {/* School Info Header */}
        {schoolInfo && (
          <View style={styles.schoolHeader}>
            <Text style={styles.schoolTitle}>Welcome to</Text>
            <Text style={styles.schoolName}>{schoolInfo.name}</Text>
            <View style={styles.schoolInfoRow}>
              {schoolInfo.join_code && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoLabel}>School Code:</Text>
                  <Text style={styles.infoValue}>{schoolInfo.join_code}</Text>
                </View>
              )}
              {schoolInfo.registration_number && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoLabel}>Registration:</Text>
                  <Text style={styles.infoValue}>{schoolInfo.registration_number}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Dashboard</Text>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalStudents || 0}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalStaff || 0}</Text>
            <Text style={styles.statLabel}>Total Staff</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalClasses || 0}</Text>
            <Text style={styles.statLabel}>Total Classes</Text>
          </Card>
        </View>

        {/* Gender Breakdowns */}
        {stats && (
          <>
            <Card style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Student Gender Breakdown</Text>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Male</Text>
                  <Text style={[styles.breakdownValue, styles.maleValue]}>
                    {stats.studentsByGender?.male || 0}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Female</Text>
                  <Text style={[styles.breakdownValue, styles.femaleValue]}>
                    {stats.studentsByGender?.female || 0}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Other</Text>
                  <Text style={[styles.breakdownValue, styles.otherValue]}>
                    {stats.studentsByGender?.other || 0}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Unknown</Text>
                  <Text style={[styles.breakdownValue, styles.unknownValue]}>
                    {stats.studentsByGender?.unknown || 0}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Staff Gender Breakdown</Text>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Male</Text>
                  <Text style={[styles.breakdownValue, styles.maleValue]}>
                    {stats.staffByGender?.male || 0}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Female</Text>
                  <Text style={[styles.breakdownValue, styles.femaleValue]}>
                    {stats.staffByGender?.female || 0}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Other</Text>
                  <Text style={[styles.breakdownValue, styles.otherValue]}>
                    {stats.staffByGender?.other || 0}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Unknown</Text>
                  <Text style={[styles.breakdownValue, styles.unknownValue]}>
                    {stats.staffByGender?.unknown || 0}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  schoolHeader: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  schoolTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
    opacity: 0.9,
  },
  schoolName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  schoolInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#fef08a',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  breakdownCard: {
    padding: 16,
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  breakdownItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  maleValue: {
    color: '#3b82f6',
  },
  femaleValue: {
    color: '#ec4899',
  },
  otherValue: {
    color: '#10b981',
  },
  unknownValue: {
    color: '#9ca3af',
  },
  quickActions: {
    marginTop: 8,
    marginBottom: 24,
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
});
