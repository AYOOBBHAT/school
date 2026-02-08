import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

// Lazy load all clerk screens for better performance
const FeeCollectionScreen = lazy(() =>
  import('../../features/clerk/screens/FeeCollectionScreen').then(module => ({
    default: module.FeeCollectionScreen,
  }))
);
const SalaryPaymentScreen = lazy(() =>
  import('../../features/clerk/screens/SalaryPaymentScreen').then(module => ({
    default: module.SalaryPaymentScreen,
  }))
);
const MarksResultsScreen = lazy(() =>
  import('../../features/clerk/screens/MarksResultsScreen').then(module => ({
    default: module.MarksResultsScreen,
  }))
);
const ClerkDashboardScreen = lazy(() =>
  import('../../features/clerk/screens/ClerkDashboardScreen').then(module => ({
    default: module.ClerkDashboardScreen,
  }))
);

const Stack = createNativeStackNavigator();

export default function ClerkStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1e293b',
          headerTitleStyle: { fontWeight: '700' },
        }}
        initialRouteName="Dashboard"
      >
        <Stack.Screen
          name="Dashboard"
          component={ClerkDashboardScreen as React.ComponentType<any>}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen
          name="FeeCollection"
          component={FeeCollectionScreen as React.ComponentType<any>}
          options={{ title: 'Fee Collection' }}
        />
        <Stack.Screen
          name="SalaryPayment"
          component={SalaryPaymentScreen as React.ComponentType<any>}
          options={{ title: 'Salary Payment' }}
        />
        <Stack.Screen
          name="MarksResults"
          component={MarksResultsScreen as React.ComponentType<any>}
          options={{ title: 'Marks & Results' }}
        />
      </Stack.Navigator>
    </Suspense>
  );
}
