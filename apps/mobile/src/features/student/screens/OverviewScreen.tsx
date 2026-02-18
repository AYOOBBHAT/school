import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { StudentScreenWrapper } from '../../../shared/components/StudentScreenWrapper';
import { useStudentProfile } from '../hooks/useProfile';
import { useStudentAttendance } from '../hooks/useAttendance';
import { useStudentFees } from '../hooks/useFees';

export function OverviewScreen() {
  const { data: profileData, isLoading: profileLoading, error: profileError, refetch: refetchProfile, isRefetching: profileRefetching } = useStudentProfile();
  const { data: attendanceData, isLoading: attendanceLoading, error: attendanceError, refetch: refetchAttendance, isRefetching: attendanceRefetching } = useStudentAttendance();
  const { data: feesData, isLoading: feesLoading, error: feesError, refetch: refetchFees, isRefetching: feesRefetching } = useStudentFees();

  const isLoading = profileLoading || attendanceLoading || feesLoading;
  const isRefetching = profileRefetching || attendanceRefetching || feesRefetching;
  const hasError = profileError || attendanceError || feesError;

  const profile = profileData?.student;
  const attendanceSummary = attendanceData?.summary;
  const feeSummary = feesData?.summary;

  const handleRefresh = () => {
    refetchProfile();
    refetchAttendance();
    refetchFees();
  };

  return (
    <StudentScreenWrapper currentRoute="Overview">
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >

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
              {typeof attendanceSummary.attendancePercentage === 'number' 
                ? attendanceSummary.attendancePercentage.toFixed(1) 
                : '0.0'}%
            </Text>
            <Text style={styles.attendanceDetail}>
              {attendanceSummary.presentDays ?? 0} present / {attendanceSummary.totalDays ?? 0} total
            </Text>
          </View>
        )}

        {/* Fee Summary */}
        {feeSummary && (
          <View style={[styles.card, styles.feeCard]}>
            <Text style={styles.cardTitle}>Fees</Text>
            <Text style={styles.feeAmount}>
              ₹{(() => {
                const pending = feeSummary.totalRemaining ?? feeSummary.pending_amount ?? 0;
                return typeof pending === 'number' ? pending.toFixed(2) : '0.00';
              })()}
            </Text>
            <Text style={styles.feeDetail}>
              ₹{(() => {
                const paid = feeSummary.totalPaid ?? feeSummary.paid_amount ?? 0;
                return typeof paid === 'number' ? paid.toFixed(2) : '0.00';
              })()} / ₹{(() => {
                const total = feeSummary.totalFees ?? feeSummary.total_fee ?? 0;
                return typeof total === 'number' ? total.toFixed(2) : '0.00';
              })()} paid
            </Text>
          </View>
        )}

        {/* Loading State */}
        {isLoading && !profile && !attendanceSummary && !feeSummary && (
          <View style={styles.centerContainer}>
            <Text style={styles.loading}>Loading...</Text>
          </View>
        )}

        {/* Error State */}
        {hasError && !isLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to load data</Text>
            <Text style={styles.errorText}>
              {profileError?.message || attendanceError?.message || feesError?.message || 'Please try again'}
            </Text>
          </View>
        )}

        {/* Empty State - No data and no errors */}
        {!isLoading && !hasError && !profile && !attendanceSummary && !feeSummary && (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No data available</Text>
          </View>
        )}
      </ScrollView>
    </StudentScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
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
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    padding: 32,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
  },
});
