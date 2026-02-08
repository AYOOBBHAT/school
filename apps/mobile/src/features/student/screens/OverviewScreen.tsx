import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudentProfile } from '../hooks/useProfile';
import { useStudentAttendance } from '../hooks/useAttendance';
import { useStudentFees } from '../hooks/useFees';

export function OverviewScreen() {
  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile, isRefetching: profileRefetching } = useStudentProfile();
  const { data: attendanceData, isLoading: attendanceLoading, refetch: refetchAttendance, isRefetching: attendanceRefetching } = useStudentAttendance();
  const { data: feesData, isLoading: feesLoading, refetch: refetchFees, isRefetching: feesRefetching } = useStudentFees();

  const isLoading = profileLoading || attendanceLoading || feesLoading;
  const isRefetching = profileRefetching || attendanceRefetching || feesRefetching;

  const profile = profileData?.student;
  const attendanceSummary = attendanceData?.summary;
  const feeSummary = feesData?.summary;

  const handleRefresh = () => {
    refetchProfile();
    refetchAttendance();
    refetchFees();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <Text style={styles.title}>Overview</Text>

        {/* Profile Card */}
        {profile && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile</Text>
            <Text style={styles.profileName}>{profile.profiles?.full_name || 'N/A'}</Text>
            <Text style={styles.profileEmail}>{profile.profiles?.email || 'N/A'}</Text>
            {profile.roll_number && (
              <Text style={styles.profileDetail}>Roll No: {profile.roll_number}</Text>
            )}
            {profile.class_groups && (
              <Text style={styles.profileDetail}>Class: {profile.class_groups.name}</Text>
            )}
            {profile.sections && (
              <Text style={styles.profileDetail}>Section: {profile.sections.name}</Text>
            )}
          </View>
        )}

        {/* Attendance Summary */}
        {attendanceSummary && (
          <View style={[styles.card, styles.attendanceCard]}>
            <Text style={styles.cardTitle}>Attendance</Text>
            <Text style={styles.attendancePercentage}>
              {attendanceSummary.attendancePercentage.toFixed(1)}%
            </Text>
            <Text style={styles.attendanceDetail}>
              {attendanceSummary.presentDays} present / {attendanceSummary.totalDays} total
            </Text>
          </View>
        )}

        {/* Fee Summary */}
        {feeSummary && (
          <View style={[styles.card, styles.feeCard]}>
            <Text style={styles.cardTitle}>Fees</Text>
            <Text style={styles.feeAmount}>
              ₹{feeSummary.pending_amount.toFixed(2)}
            </Text>
            <Text style={styles.feeDetail}>
              ₹{feeSummary.paid_amount.toFixed(2)} / ₹{feeSummary.total_fee.toFixed(2)} paid
            </Text>
          </View>
        )}

        {isLoading && !profile && !attendanceSummary && !feeSummary && (
          <Text style={styles.loading}>Loading...</Text>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendanceCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  feeCard: {
    backgroundColor: '#faf5ff',
    borderColor: '#c084fc',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  profileDetail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  attendancePercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  attendanceDetail: {
    fontSize: 14,
    color: '#64748b',
  },
  feeAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#a855f7',
    marginBottom: 4,
  },
  feeDetail: {
    fontSize: 14,
    color: '#64748b',
  },
  loading: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 32,
  },
});
