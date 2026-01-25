import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../shared/components/Button';
import { Input } from '../shared/components/Input';
import { authService } from '../shared/services/auth';
import { api } from '../shared/services/api';
import { useAuth } from '../navigation/AuthContext';
import { queryClient } from '../../App';
import { queryKeys } from '../shared/queryKeys';
import { loadDashboard, loadStudents, loadClasses } from '../shared/services/principal.service';
import { loadTeacherAssignments, loadTeacherAttendanceAssignments, loadTeacherSalary } from '../shared/services/teacher.service';
import { loadStudents as loadClerkStudents, loadClasses as loadClerkClasses, loadUnpaidSalaries } from '../shared/services/clerk.service';
import { loadAttendance, loadMarks, loadFees } from '../shared/services/student.service';

import { NavigationProp } from '../shared/types';

interface LoginScreenProps {
  navigation: NavigationProp;
}

export function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      console.log('[LoginScreen] Attempting login for:', email);
      const response = await authService.login(email, password);
      console.log('[LoginScreen] Login successful, user:', response.user?.email);
      
      // Ensure token is set in API service before navigating (should already be set by saveAuth, but verify)
      if (response.token) {
        await api.setToken(response.token);
        console.log('[LoginScreen] Token verified and set in API service before navigation');
      } else {
        console.error('[LoginScreen] WARNING: No token in login response!');
      }
      
      const user = response.user;
      
      // Prefetch role-specific data immediately after login for instant screen loads
      // Do not await - let it run in background while navigation happens
      prefetchRoleData(user.role, user.id);
      
      setUser(user);
    } catch (error: unknown) {
      console.error('[LoginScreen] Login error:', error);
      const message = error instanceof Error ? error.message : 'Login failed';
      const stack = error instanceof Error ? error.stack : undefined;
      console.error('[LoginScreen] Error message:', message);
      if (stack) console.error('[LoginScreen] Error stack:', stack);
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Prefetch all important queries for the user's role
   * This runs in background - navigation doesn't wait for it
   */
  const prefetchRoleData = (role: string, userId: string) => {
    try {
      if (role === 'principal') {
        // Prefetch principal dashboard and key screens
        queryClient.prefetchQuery({
          queryKey: queryKeys.principal.dashboard,
          queryFn: loadDashboard,
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.principal.students,
          queryFn: loadStudents,
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.principal.classes,
          queryFn: loadClasses,
        });
      } else if (role === 'teacher') {
        // Prefetch teacher assignments, attendance, and salary
        queryClient.prefetchQuery({
          queryKey: queryKeys.teacher.assignments(userId),
          queryFn: () => loadTeacherAssignments(userId),
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.teacher.attendanceAssignments(userId),
          queryFn: () => loadTeacherAttendanceAssignments(userId),
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.teacher.salary,
          queryFn: loadTeacherSalary,
        });
      } else if (role === 'clerk') {
        // Prefetch clerk students, classes, and unpaid salaries
        queryClient.prefetchQuery({
          queryKey: queryKeys.clerk.students,
          queryFn: loadClerkStudents,
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.clerk.classes,
          queryFn: loadClerkClasses,
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.clerk.unpaidSalaries('all'),
          queryFn: () => loadUnpaidSalaries('all'),
        });
      } else if (role === 'student') {
        // Prefetch student attendance, marks, and fees
        queryClient.prefetchQuery({
          queryKey: queryKeys.student.attendance({ student_id: userId }),
          queryFn: () => loadAttendance({ student_id: userId }),
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.student.marks({ student_id: userId }),
          queryFn: () => loadMarks({ student_id: userId }),
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.student.fees({ student_id: userId }),
          queryFn: () => loadFees({ student_id: userId }),
        });
      }
    } catch (error) {
      // Silently fail prefetching - don't block login
      console.warn('[LoginScreen] Prefetch error (non-blocking):', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>School SaaS</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Text
              style={styles.link}
              onPress={() => navigation.navigate('Signup')}
            >
              Sign up
            </Text>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  form: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
  },
  link: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
});

