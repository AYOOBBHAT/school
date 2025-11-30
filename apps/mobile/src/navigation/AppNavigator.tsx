import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MyAttendanceScreen, MyMarksScreen, MyFeesScreen } from '../screens/StudentScreens';
import { useAuth } from './AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();
// Billing feature removed in this deployment
const BILLING_ENABLED = false;

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
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
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
      {BILLING_ENABLED && (
        <Stack.Screen
          name="MyFees"
          component={MyFeesScreen}
          options={{ title: 'My Fees' }}
        />
      )}
      <Stack.Screen
        name="Students"
        component={() => <View><Text>Students Management</Text></View>}
        options={{ title: 'Students' }}
      />
      <Stack.Screen
        name="Classes"
        component={() => <View><Text>Classes Management</Text></View>}
        options={{ title: 'Classes' }}
      />
      <Stack.Screen
        name="Attendance"
        component={() => <View><Text>Mark Attendance</Text></View>}
        options={{ title: 'Mark Attendance' }}
      />
      <Stack.Screen
        name="Marks"
        component={() => <View><Text>Enter Marks</Text></View>}
        options={{ title: 'Enter Marks' }}
      />
      {BILLING_ENABLED && (
        <>
          <Stack.Screen
            name="Fees"
            component={() => <View><Text>Manage Fees</Text></View>}
            options={{ title: 'Manage Fees' }}
          />
          <Stack.Screen
            name="Payments"
            component={() => <View><Text>View Payments</Text></View>}
            options={{ title: 'Payments' }}
          />
        </>
      )}
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

