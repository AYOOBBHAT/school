import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

// Lazy load all principal screens for better performance
const StudentsScreen = lazy(() =>
  import('../../features/principal/screens/StudentsScreen').then(module => ({
    default: module.StudentsScreen,
  }))
);
const ClassesScreen = lazy(() =>
  import('../../features/principal/screens/ClassesScreen').then(module => ({
    default: module.ClassesScreen,
  }))
);
const StaffScreen = lazy(() =>
  import('../../features/principal/screens/StaffScreen').then(module => ({
    default: module.StaffScreen,
  }))
);
const SubjectsScreen = lazy(() =>
  import('../../features/principal/screens/SubjectsScreen').then(module => ({
    default: module.SubjectsScreen,
  }))
);
const ExamsScreen = lazy(() =>
  import('../../features/principal/screens/ExamsScreen').then(module => ({
    default: module.ExamsScreen,
  }))
);
const ClassificationsScreen = lazy(() =>
  import('../../features/principal/screens/ClassificationsScreen').then(module => ({
    default: module.ClassificationsScreen,
  }))
);
const SalaryScreen = lazy(() =>
  import('../../features/principal/screens/SalaryScreen').then(module => ({
    default: module.SalaryScreen,
  }))
);
const FeesScreen = lazy(() => import('../../features/principal/screens/FeesScreen'));

const Stack = createNativeStackNavigator();

export default function PrincipalStack() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1e293b',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
      <Stack.Screen
        name="Students"
        component={StudentsScreen}
        options={{ title: 'Students' }}
      />
      <Stack.Screen
        name="Classes"
        component={ClassesScreen}
        options={{ title: 'Classes' }}
      />
      <Stack.Screen
        name="Staff"
        component={StaffScreen}
        options={{ title: 'Staff Management' }}
      />
      <Stack.Screen
        name="Subjects"
        component={SubjectsScreen}
        options={{ title: 'Subjects' }}
      />
      <Stack.Screen
        name="Exams"
        component={ExamsScreen}
        options={{ title: 'Exams' }}
      />
      <Stack.Screen
        name="Classifications"
        component={ClassificationsScreen}
        options={{ title: 'Classifications' }}
      />
      <Stack.Screen
        name="Salary"
        component={SalaryScreen}
        options={{ title: 'Salary Management' }}
      />
      <Stack.Screen
        name="Fees"
        component={FeesScreen as React.ComponentType<any>}
        options={{ title: 'Fee Management' }}
      />
      </Stack.Navigator>
    </Suspense>
  );
}
