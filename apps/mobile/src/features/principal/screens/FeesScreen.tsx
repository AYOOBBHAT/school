import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { PrincipalStackScreenProps } from '../../../navigation/types';

type Props = PrincipalStackScreenProps<'Fees'>;

export default function FeesScreen({ navigation }: Props) {

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fee Management</Text>
      </View>
      <View style={styles.emptyContainer}>
        <EmptyState icon="💵" title="Fee Management" message="Fee management features coming soon" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  emptyContainer: { flex: 1 },
});
