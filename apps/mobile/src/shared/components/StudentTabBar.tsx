import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StudentStackParamList } from '../../navigation/types';

type StudentTabBarProps = {
  currentRoute?: string;
};

type NavigationProp = NativeStackNavigationProp<StudentStackParamList>;

const tabs = [
  { key: 'Overview', label: 'Overview' },
  { key: 'MyAttendance', label: 'Attendance' },
  { key: 'MyMarks', label: 'Marks' },
  { key: 'MyFees', label: 'Fees' },
];

export function StudentTabBar({ currentRoute }: StudentTabBarProps) {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  
  // Get current route name
  const activeRoute = currentRoute || route.name;

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeRoute === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => {
              if (activeRoute !== tab.key) {
                navigation.navigate(tab.key as keyof StudentStackParamList);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTab: {
    // Active tab styling
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  activeTabText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
});
