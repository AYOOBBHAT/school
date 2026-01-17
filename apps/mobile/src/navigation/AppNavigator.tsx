import React, { lazy, Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MyAttendanceScreen, MyMarksScreen, MyFeesScreen } from '../screens/StudentScreens';
import { MarkAttendanceScreen, EnterMarksScreen } from '../screens/TeacherScreens';
import { useAuth } from './AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Lazy load screens for better performance
const StudentsScreen = lazy(() => import('../screens/PrincipalScreens').then(m => ({ default: m.StudentsScreen })));
const ClassesScreen = lazy(() => import('../screens/PrincipalScreens').then(m => ({ default: m.ClassesScreen })));

const Stack = createNativeStackNavigator();

// Loading wrapper for lazy components
const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner message="Loading..." fullScreen />}>
    {children}
  </Suspense>
);

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1e293b',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      
      {/* Student Screens */}
      <Stack.Screen
        name="MyAttendance"
        component={MyAttendanceScreen}
        options={{ title: 'My Attendance' }}
      />
      <Stack.Screen
        name="MyMarks"
        component={MyMarksScreen}
        options={{ title: 'My Marks' }}
      />
      <Stack.Screen
        name="MyFees"
        component={MyFeesScreen}
        options={{ title: 'My Fees' }}
      />

      {/* Teacher Screens */}
      <Stack.Screen
        name="Attendance"
        component={MarkAttendanceScreen}
        options={{ title: 'Mark Attendance' }}
      />
      <Stack.Screen
        name="Marks"
        component={EnterMarksScreen}
        options={{ title: 'Enter Marks' }}
      />

      {/* Principal Screens */}
      <Stack.Screen
        name="Students"
        options={{ title: 'Students' }}
      >
        {() => (
          <LazyWrapper>
            <StudentsScreen />
          </LazyWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Classes"
        options={{ title: 'Classes' }}
      >
        {() => (
          <LazyWrapper>
            <ClassesScreen />
          </LazyWrapper>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});

