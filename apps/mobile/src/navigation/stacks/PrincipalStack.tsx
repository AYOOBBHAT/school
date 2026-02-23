import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';
import { useAuth } from '../AuthContext';

// Lazy load all principal screens for better performance
const StudentsScreen = lazy(() =>
  import('../../features/principal/screens/StudentsScreen').then(module => ({
    default: module.StudentsScreen,
  }))
);
const StaffScreen = lazy(() =>
  import('../../features/principal/screens/StaffScreen').then(module => ({
    default: module.StaffScreen,
  }))
);
const ExamsScreen = lazy(() =>
  import('../../features/principal/screens/ExamsScreen').then(module => ({
    default: module.ExamsScreen,
  }))
);
const ClassificationsScreen = lazy(() =>
  import('../../features/principal/screens/ClassificationsScreen').then(module => ({
    default: module.ClassificationsScreen,
  }))
);
const UnpaidFeeAnalyticsScreen = lazy(() =>
  import('../../features/principal/screens/UnpaidFeeAnalyticsScreen').then(module => ({
    default: module.UnpaidFeeAnalyticsScreen,
  }))
);
const SalaryScreen = lazy(() =>
  import('../../features/principal/screens/SalaryScreen').then(module => ({
    default: module.SalaryScreen,
  }))
);
const PrincipalDashboardScreen = lazy(() =>
  import('../../features/principal/screens/PrincipalDashboardScreen').then(module => ({
    default: module.PrincipalDashboardScreen,
  }))
);

const Stack = createNativeStackNavigator();

// Role guard component for Principal
function PrincipalRoleGuard({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorText}>Please log in to access principal features.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if ((user.role ?? '').toLowerCase() !== 'principal') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            This section is only available for principals.{'\n'}
            You are currently logged in as: <Text style={styles.roleText}>{user.role}</Text>
          </Text>
          <Text style={styles.errorHint}>
            Please log out and log in with a principal account to access these features.
          </Text>
          
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

export default function PrincipalStack() {
  const { logout } = useAuth();

  // Logout button component for header
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
    <PrincipalRoleGuard>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#1e293b',
            headerTitleStyle: { fontWeight: '700' },
            headerRight: LogoutButton,
          }}
          initialRouteName="Dashboard"
        >
          <Stack.Screen
            name="Dashboard"
            component={PrincipalDashboardScreen as React.ComponentType<any>}
            options={{ title: 'Dashboard' }}
          />
          <Stack.Screen
            name="Students"
            component={StudentsScreen as React.ComponentType<any>}
            options={{ title: 'Students' }}
          />
          <Stack.Screen
            name="Staff"
            component={StaffScreen}
            options={{ title: 'Staff Management' }}
          />
          <Stack.Screen
            name="Exams"
            component={ExamsScreen}
            options={{ title: 'Exams' }}
          />
          <Stack.Screen
            name="Classifications"
            component={ClassificationsScreen}
            options={{ title: 'Classifications' }}
          />
          <Stack.Screen
            name="UnpaidFeeAnalytics"
            component={UnpaidFeeAnalyticsScreen}
            options={{ title: 'Unpaid Fee Analytics' }}
          />
          <Stack.Screen
            name="Salary"
            component={SalaryScreen as React.ComponentType<object>}
            options={{ title: 'Salary Management' }}
          />
        </Stack.Navigator>
      </Suspense>
    </PrincipalRoleGuard>
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
});
