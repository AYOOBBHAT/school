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

const Stack = createNativeStackNavigator();

export default function ClerkStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeeCollection" component={FeeCollectionScreen as React.ComponentType<any>} />
      <Stack.Screen name="SalaryPayment" component={SalaryPaymentScreen as React.ComponentType<any>} />
      <Stack.Screen name="MarksResults" component={MarksResultsScreen as React.ComponentType<any>} />
      </Stack.Navigator>
    </Suspense>
  );
}
