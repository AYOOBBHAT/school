import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';
import { StudentTabBar } from '../../shared/components/StudentTabBar';
import { useAuth } from '../AuthContext';
import { ResetPasswordScreen } from '../../screens/common/ResetPasswordScreen';
import type { StudentStackParamList } from '../types';

// Lazy load all student screens for better performance
const OverviewScreen = lazy(() =>
  import('../../features/student/screens/OverviewScreen').then(module => ({
    default: module.OverviewScreen,
  }))
);
const MyAttendanceScreen = lazy(() =>
  import('../../features/student/screens/MyAttendanceScreen').then(module => ({
    default: module.MyAttendanceScreen,
  }))
);
const MyMarksScreen = lazy(() =>
  import('../../features/student/screens/MyMarksScreen').then(module => ({
    default: module.MyMarksScreen,
  }))
);
const MyFeesScreen = lazy(() =>
  import('../../features/student/screens/MyFeesScreen').then(module => ({
    default: module.MyFeesScreen,
  }))
);

const Stack = createNativeStackNavigator<StudentStackParamList>();

// Role guard component
function StudentRoleGuard({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorText}>Please log in to access student features.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if ((user.role ?? '').toLowerCase() !== 'student') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            This section is only available for students.{'\n'}
            You are currently logged in as: <Text style={styles.roleText}>{user.role}</Text>
          </Text>
          <Text style={styles.errorHint}>
            Please log out and log in with a student account to access these features.
          </Text>
          
          {/* Logout Button - Made very visible */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutButtonText}>🚪 LOG OUT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

export default function StudentStack() {
  const { logout } = useAuth();

  // Logout button component for header - defined inside to access context
  const LogoutButton = () => {
    return (
      <TouchableOpacity
        onPress={async () => {
          await logout();
        }}
        style={styles.headerLogoutButton}
        activeOpacity={0.7}
      >
        <Text style={styles.headerLogoutText}>🚪 Logout</Text>
      </TouchableOpacity>
    );
  };

  return (
    <StudentRoleGuard>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Stack.Navigator
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#1e293b',
            headerTitleStyle: { fontWeight: '700' },
            headerRight: LogoutButton,
          }}
          initialRouteName="Overview"
        >
        <Stack.Screen
          name="Overview"
          component={OverviewScreen}
          options={{ 
            title: 'Student Dashboard',
            headerTitle: () => (
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Student Dashboard</Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="MyAttendance"
          component={MyAttendanceScreen}
          options={{ 
            title: 'Student Dashboard',
            headerTitle: () => (
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Student Dashboard</Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="MyMarks"
          component={MyMarksScreen}
          options={{ 
            title: 'Student Dashboard',
            headerTitle: () => (
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Student Dashboard</Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="MyFees"
          component={MyFeesScreen}
          options={{ 
            title: 'Student Dashboard',
            headerTitle: () => (
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Student Dashboard</Text>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{
            title: 'Change password',
            headerTitle: () => (
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Change password</Text>
              </View>
            ),
          }}
        />
      </Stack.Navigator>
    </Suspense>
    </StudentRoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  roleText: {
    fontWeight: '700',
    color: '#1e293b',
    textTransform: 'capitalize',
  },
  errorHint: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  logoutButton: {
    marginTop: 40,
    paddingVertical: 18,
    paddingHorizontal: 48,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    minWidth: 200,
    borderWidth: 3,
    borderColor: '#991b1b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    alignSelf: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  headerLogoutButton: {
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
});
