import React from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClassifications } from '../hooks/useClassifications';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';
import { Card } from '../../../shared/components/Card';
import { EmptyState } from '../../../shared/components/EmptyState';
import { NavigationProp } from '../../../shared/types';

interface ClassificationsScreenProps {
  navigation: NavigationProp;
}

export function ClassificationsScreen({ navigation }: ClassificationsScreenProps) {
  const { data: classificationsData, isLoading, refetch, isRefetching } = useClassifications();
  const types = classificationsData?.types || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading classifications..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classifications</Text>
      </View>

      <FlatList
        data={types}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        contentContainerStyle={types.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={<EmptyState icon="🏷️" title="No classifications found" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  list: { padding: 16 },
  emptyContainer: { flex: 1 },
  card: { marginBottom: 12, padding: 16 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
});
