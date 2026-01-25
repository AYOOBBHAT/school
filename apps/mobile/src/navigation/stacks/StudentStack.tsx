import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

// Lazy load all student screens for better performance
const DashboardScreen = lazy(() =>
  import('../../screens/DashboardScreen').then(module => ({
    default: module.DashboardScreen,
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

const Stack = createNativeStackNavigator();

export default function StudentStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Overview" component={DashboardScreen} />
      <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} />
      <Stack.Screen name="MyMarks" component={MyMarksScreen} />
      <Stack.Screen name="MyFees" component={MyFeesScreen} />
      </Stack.Navigator>
    </Suspense>
  );
}
