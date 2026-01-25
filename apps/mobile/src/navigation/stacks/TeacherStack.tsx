import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

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

const Stack = createNativeStackNavigator();

export default function TeacherStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyClasses" component={MyClassesScreen as React.ComponentType<any>} />
      <Stack.Screen name="MarkAttendance" component={MarkAttendanceScreen as React.ComponentType<any>} />
      <Stack.Screen name="EnterMarks" component={EnterMarksScreen as React.ComponentType<any>} />
      <Stack.Screen name="MySalary" component={MySalaryScreen as React.ComponentType<any>} />
      </Stack.Navigator>
    </Suspense>
  );
}
