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
const StudentFeeStatusScreen = lazy(() =>
  import('../../features/teacher/screens/StudentFeeStatusScreen').then(module => ({
    default: module.StudentFeeStatusScreen,
  }))
);

const Stack = createNativeStackNavigator();

export default function TeacherStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1e293b',
          headerTitleStyle: { fontWeight: '700' },
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
  );
}
