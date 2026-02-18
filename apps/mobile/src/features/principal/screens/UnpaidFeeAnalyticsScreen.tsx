import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UnpaidFeeAnalytics } from '../../../shared/components/UnpaidFeeAnalytics';
import { NavigationProp } from '../../../shared/types';

interface UnpaidFeeAnalyticsScreenProps {
  navigation: NavigationProp;
}

/**
 * Principal screen for Unpaid Fee Analytics (from Quick Actions).
 * Reuses shared UnpaidFeeAnalytics without the payment status distribution chart.
 */
export function UnpaidFeeAnalyticsScreen({ navigation }: UnpaidFeeAnalyticsScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          <UnpaidFeeAnalytics userRole="principal" showChart={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  content: { flex: 1 },
});
