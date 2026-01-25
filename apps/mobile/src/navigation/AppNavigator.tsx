import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { useAuth } from './AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LoadingSpinner } from '../shared/components/LoadingSpinner';

// Lazy load role stacks for better performance
const PrincipalStack = lazy(() => import('./stacks/PrincipalStack'));
const TeacherStack = lazy(() => import('./stacks/TeacherStack'));
const ClerkStack = lazy(() => import('./stacks/ClerkStack'));
const StudentStack = lazy(() => import('./stacks/StudentStack'));

const Stack = createNativeStackNavigator();

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
      {/* Student Screens */}
      <Stack.Screen
        name="Student"
        options={{ headerShown: false }}
      >
        {() => (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <StudentStack />
          </Suspense>
        )}
      </Stack.Screen>

      {/* Teacher Screens */}
      <Stack.Screen
        name="Teacher"
        options={{ headerShown: false }}
      >
        {() => (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <TeacherStack />
          </Suspense>
        )}
      </Stack.Screen>

      {/* Principal Screens */}
      <Stack.Screen
        name="Principal"
        options={{ headerShown: false }}
      >
        {() => (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <PrincipalStack />
          </Suspense>
        )}
      </Stack.Screen>

      {/* Clerk Screens */}
      <Stack.Screen
        name="Clerk"
        options={{ headerShown: false }}
      >
        {() => (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <ClerkStack />
          </Suspense>
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

