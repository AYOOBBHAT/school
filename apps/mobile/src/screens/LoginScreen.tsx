import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../shared/components/Button';
import { Input } from '../shared/components/Input';
import { authService } from '../shared/services/auth';
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
  const [loginMode, setLoginMode] = useState<'email' | 'username'>('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [useRegistrationNumber, setUseRegistrationNumber] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser, clearStoredAuth } = useAuth();

  const handleLogin = async () => {
    if (loginMode === 'email') {
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
    } else {
      if (!username || !password || !schoolCode) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
    }

    setLoading(true);
    try {
      console.log('[LoginScreen] Starting login process...');
      let response;
      
      if (loginMode === 'username') {
        console.log('[LoginScreen] Attempting username login for:', username);
        const loginData: {
          username: string;
          password: string;
          join_code?: string;
          registration_number?: string;
        } = {
          username,
          password,
        };
        
        if (useRegistrationNumber) {
          loginData.registration_number = schoolCode;
        } else {
          loginData.join_code = schoolCode;
        }
        
        console.log('[LoginScreen] Calling authService.loginUsername...');
        response = await authService.loginUsername(loginData);
        console.log('[LoginScreen] Username login successful, user:', response.user?.email);
      } else {
        console.log('[LoginScreen] Attempting email login for:', email);
        console.log('[LoginScreen] Calling authService.login...');
        response = await authService.login(email, password);
        console.log('[LoginScreen] Email login successful, user:', response.user?.email);
      }
      
      console.log('[LoginScreen] Login response received:', {
        hasUser: !!response.user,
        hasToken: !!response.token,
        userRole: response.user?.role,
        userId: response.user?.id,
      });
      
      if (!response.user) {
        console.error('[LoginScreen] WARNING: No user in login response!');
        throw new Error('Login response missing user data');
      }
      
      const user = response.user;
      console.log('[LoginScreen] Setting user in context:', { id: user.id, role: user.role, email: user.email });
      
      // Prefetch role-specific data immediately after login for instant screen loads
      // Do not await - let it run in background while navigation happens
      prefetchRoleData(user.role, user.id);
      
      console.log('[LoginScreen] Calling setUser...');
      setUser(user);
      console.log('[LoginScreen] setUser called successfully');
    } catch (error: unknown) {
      console.error('[LoginScreen] Login error:', error);
      const message = error instanceof Error ? error.message : 'Login failed';
      const stack = error instanceof Error ? error.stack : undefined;
      console.error('[LoginScreen] Error message:', message);
      if (stack) console.error('[LoginScreen] Error stack:', stack);
      Alert.alert('Login Failed', message);
    } finally {
      console.log('[LoginScreen] Setting loading to false');
      setLoading(false);
    }
  };

  /**
   * Prefetch all important queries for the user's role
   * This runs in background - navigation doesn't wait for it
   */
  const prefetchRoleData = (role: string, userId: string) => {
    try {
      const normalizedRole = (role ?? '').toLowerCase();
      if (normalizedRole === 'principal') {
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
      } else if (normalizedRole === 'teacher') {
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
          queryFn: () => loadTeacherSalary(userId),
        });
      } else if (normalizedRole === 'clerk') {
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
      } else if (normalizedRole === 'student') {
        // Prefetch student attendance, marks, and fees
        queryClient.prefetchQuery({
          queryKey: queryKeys.student.attendance(),
          queryFn: loadAttendance,
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.student.marks(),
          queryFn: loadMarks,
        });
        queryClient.prefetchQuery({
          queryKey: queryKeys.student.fees(),
          queryFn: loadFees,
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
          {/* Login Mode Toggle */}
          <View style={styles.toggleContainer}>
            <View style={styles.toggleBackground}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  loginMode === 'email' && styles.toggleButtonActive,
                ]}
                onPress={() => {
                  setLoginMode('email');
                  setEmail('');
                  setUsername('');
                  setSchoolCode('');
                }}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    loginMode === 'email' && styles.toggleButtonTextActive,
                  ]}
                >
                  Principal/Staff
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  loginMode === 'username' && styles.toggleButtonActive,
                ]}
                onPress={() => {
                  setLoginMode('username');
                  setEmail('');
                  setUsername('');
                  setSchoolCode('');
                }}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    loginMode === 'username' && styles.toggleButtonTextActive,
                  ]}
                >
                  Student
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {loginMode === 'email' ? (
            <>
              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </>
          ) : (
            <>
              <Input
                label="Student Username"
                placeholder="Enter your student username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
              />
              <View style={styles.schoolCodeContainer}>
                <View style={styles.schoolCodeHeader}>
                  <Text style={styles.schoolCodeLabel}>
                    {useRegistrationNumber ? 'School Registration Number' : 'School Join Code'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setUseRegistrationNumber(!useRegistrationNumber);
                      setSchoolCode('');
                    }}
                  >
                    <Text style={styles.switchText}>
                      Use {useRegistrationNumber ? 'Join Code' : 'Registration Number'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Input
                  label={useRegistrationNumber ? 'School Registration Number' : 'School Join Code'}
                  placeholder={
                    useRegistrationNumber
                      ? 'Enter school registration number'
                      : 'Enter school join code'
                  }
                  value={schoolCode}
                  onChangeText={(text) => setSchoolCode(text.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={styles.helperText}>
                  {useRegistrationNumber
                    ? "Enter your school's registration number"
                    : "Enter your school's join code (usually provided by your administrator)"}
                </Text>
              </View>
            </>
          )}

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

          {/* Dev: Clear Stored Auth Button */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.clearAuthButton}
              onPress={async () => {
                Alert.alert(
                  'Clear Stored Auth',
                  'This will clear all stored authentication data. You will need to log in again.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        await clearStoredAuth();
                        Alert.alert('Success', 'Stored auth data cleared. Please reload the app.');
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.clearAuthText}>🧹 Clear Stored Auth (Dev)</Text>
            </TouchableOpacity>
          )}
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
  toggleContainer: {
    marginBottom: 24,
  },
  toggleBackground: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleButtonTextActive: {
    color: '#2563eb',
  },
  schoolCodeContainer: {
    marginBottom: 16,
  },
  schoolCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  schoolCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  switchText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  clearAuthButton: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
  },
  clearAuthText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
});

