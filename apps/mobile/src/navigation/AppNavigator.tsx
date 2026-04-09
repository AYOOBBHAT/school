import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { useAuth } from './AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LoadingSpinner } from '../shared/components/LoadingSpinner';
import type { RootStackParamList } from './types';

// Lazy load role stacks for better performance
const PrincipalStack = lazy(() => import('./stacks/PrincipalStack'));
const TeacherStack = lazy(() => import('./stacks/TeacherStack'));
const ClerkStack = lazy(() => import('./stacks/ClerkStack'));
const StudentStack = lazy(() => import('./stacks/StudentStack'));

const AuthStack = createNativeStackNavigator<RootStackParamList>();
const AppStack = createNativeStackNavigator();

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
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Signup" component={SignupScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  // Render only the stack for the current role (avoids initialRouteName/first-screen issues)
  const role = (user.role ?? '').toLowerCase();
  const renderRoleStack = () => {
    switch (role) {
      case 'principal':
        return (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <PrincipalStack />
          </Suspense>
        );
      case 'teacher':
        return (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <TeacherStack />
          </Suspense>
        );
      case 'clerk':
        return (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <ClerkStack />
          </Suspense>
        );
      case 'student':
      default:
        return (
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <StudentStack />
          </Suspense>
        );
    }
  };

  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1e293b',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <AppStack.Screen name="RoleStack" options={{ headerShown: false }}>
        {() => renderRoleStack()}
      </AppStack.Screen>
    </AppStack.Navigator>
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

