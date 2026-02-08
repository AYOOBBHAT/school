import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { loadDashboardStats, DashboardStats } from '../../../shared/services/clerk.service';
import { queryKeys } from '../../../shared/queryKeys';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { NavigationProp } from '../../../shared/types';

interface ClerkDashboardScreenProps {
  navigation: NavigationProp;
}

export function ClerkDashboardScreen({ navigation }: ClerkDashboardScreenProps) {
  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['clerk', 'dashboard'],
    queryFn: loadDashboardStats,
    staleTime: 2 * 60 * 1000, // 2 minutes - stats change frequently
    retry: 1,
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <Text style={styles.title}>Dashboard Overview</Text>

        {/* Statistics Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Total Students</Text>
                <Text style={styles.statValue}>{stats?.totalStudents || 0}</Text>
              </View>
              <Text style={styles.statIcon}>👥</Text>
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Today's Collection</Text>
                <Text style={[styles.statValue, styles.collectionValue]}>
                  ₹{stats?.todayCollection?.toFixed(2) || '0.00'}
                </Text>
              </View>
              <Text style={styles.statIcon}>💰</Text>
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Total Pending</Text>
                <Text style={[styles.statValue, styles.pendingValue]}>
                  ₹{stats?.totalPending?.toFixed(2) || '0.00'}
                </Text>
              </View>
              <Text style={styles.statIcon}>📋</Text>
            </View>
          </Card>
        </View>

        {/* Recent Payments */}
        <Card style={styles.recentPaymentsCard}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {stats?.recentPayments && stats.recentPayments.length > 0 ? (
            <FlatList
              data={stats.recentPayments.slice(0, 10)}
              keyExtractor={(item, index) => `${item.payment_date}-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentDate}>
                      {new Date(item.payment_date).toLocaleDateString()}
                    </Text>
                    <Text style={styles.paymentMode}>
                      {item.payment_mode?.toUpperCase() || 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    ₹{parseFloat(String(item.payment_amount || 0)).toFixed(2)}
                  </Text>
                </View>
              )}
            />
          ) : (
            <Text style={styles.emptyText}>No recent payments</Text>
          )}
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Clerk', { screen: 'FeeCollection' })}
          >
            <Text style={styles.actionIcon}>💰</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Collect Fees</Text>
              <Text style={styles.actionSubtitle}>Record fee payments from students</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Clerk', { screen: 'SalaryPayment' })}
          >
            <Text style={styles.actionIcon}>💵</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Pay Salary</Text>
              <Text style={styles.actionSubtitle}>Record salary payments to teachers</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Clerk', { screen: 'MarksResults' })}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Results</Text>
              <Text style={styles.actionSubtitle}>View marks and exam results</Text>
            </View>
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
  title: {
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
    padding: 16,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  collectionValue: {
    color: '#10b981',
  },
  pendingValue: {
    color: '#ef4444',
  },
  statIcon: {
    fontSize: 32,
  },
  recentPaymentsCard: {
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  paymentMode: {
    fontSize: 12,
    color: '#64748b',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    paddingVertical: 24,
  },
  quickActions: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
});
