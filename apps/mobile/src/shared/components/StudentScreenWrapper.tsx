import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StudentTabBar } from './StudentTabBar';
import { useStudentProfile } from '../../features/student/hooks/useProfile';

interface StudentScreenWrapperProps {
  children: React.ReactNode;
  currentRoute: string;
}

export function StudentScreenWrapper({ children, currentRoute }: StudentScreenWrapperProps) {
  const { data: profileData } = useStudentProfile();
  const profile = profileData?.student;

  // Get student info from profile
  const studentName = profile?.profiles?.full_name || 'Student';
  const rollNumber = profile?.roll_number || '';
  const className = profile?.class_groups?.name || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Student Info Header */}
      <View style={styles.infoHeader}>
        <Text style={styles.infoText}>
          {studentName}
          {rollNumber && ` • Roll No: ${rollNumber}`}
          {className && ` • ${className}`}
        </Text>
      </View>

      {/* Tab Navigation */}
      <StudentTabBar currentRoute={currentRoute} />

      {/* Screen Content */}
      <View style={styles.content}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  infoHeader: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
});
