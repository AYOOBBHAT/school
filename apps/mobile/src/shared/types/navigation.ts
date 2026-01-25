/**
 * Navigation Types
 * Re-export from navigation/types for convenience
 */

export * from '../../navigation/types';

// Legacy compatibility - keep NavigationProp for backward compatibility
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
