import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

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

const Stack = createNativeStackNavigator();

export default function StudentStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1e293b',
          headerTitleStyle: { fontWeight: '700' },
        }}
        initialRouteName="Overview"
      >
        <Stack.Screen
          name="Overview"
          component={OverviewScreen}
          options={{ title: 'Overview' }}
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
        <Stack.Screen
          name="MyFees"
          component={MyFeesScreen}
          options={{ title: 'My Fees' }}
        />
      </Stack.Navigator>
    </Suspense>
  );
}
