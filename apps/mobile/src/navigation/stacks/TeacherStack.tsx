import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';
import { useAuth } from '../AuthContext';

// Lazy load all teacher screens for better performance
const MyClassesScreen = lazy(() =>
  import('../../features/teacher/screens/MyClassesScreen').then(module => ({
    default: module.MyClassesScreen,
  }))
);
const MarkAttendanceScreen = lazy(() =>
  import('../../features/teacher/screens/MarkAttendanceScreen').then(module => ({
    default: module.MarkAttendanceScreen,
  }))
);
const EnterMarksScreen = lazy(() =>
  import('../../features/teacher/screens/EnterMarksScreen').then(module => ({
    default: module.EnterMarksScreen,
  }))
);
const MySalaryScreen = lazy(() =>
  import('../../features/teacher/screens/MySalaryScreen').then(module => ({
    default: module.MySalaryScreen,
  }))
);
const StudentFeeStatusScreen = lazy(() =>
  import('../../features/teacher/screens/StudentFeeStatusScreen').then(module => ({
    default: module.StudentFeeStatusScreen,
  }))
);

const Stack = createNativeStackNavigator();

// Role guard component for Teacher
function TeacherRoleGuard({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorText}>Please log in to access teacher features.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if ((user.role ?? '').toLowerCase() !== 'teacher') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            This section is only available for teachers.{'\n'}
            You are currently logged in as: <Text style={styles.roleText}>{user.role}</Text>
          </Text>
          <Text style={styles.errorHint}>
            Please log out and log in with a teacher account to access these features.
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

export default function TeacherStack() {
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
    <TeacherRoleGuard>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Stack.Navigator
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#1e293b',
            headerTitleStyle: { fontWeight: '700' },
            headerRight: LogoutButton,
          }}
          initialRouteName="MyClasses"
        >
          <Stack.Screen name="MyClasses" component={MyClassesScreen as React.ComponentType<any>} options={{ title: 'My Classes' }} />
          <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen as React.ComponentType<any>} options={{ title: 'Mark Attendance' }} />
          <Stack.Screen name="EnterMarks" component={EnterMarksScreen as React.ComponentType<any>} options={{ title: 'Enter Marks' }} />
          <Stack.Screen name="MySalary" component={MySalaryScreen as React.ComponentType<any>} options={{ title: 'My Salary' }} />
          <Stack.Screen name="StudentFeeStatus" component={StudentFeeStatusScreen as React.ComponentType<any>} options={{ title: 'Student Fee Status' }} />
        </Stack.Navigator>
      </Suspense>
    </TeacherRoleGuard>
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
