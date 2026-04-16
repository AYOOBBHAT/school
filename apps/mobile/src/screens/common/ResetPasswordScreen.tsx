import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Input } from '../../shared/components/Input';
import { PasswordInput } from '../../shared/components/PasswordInput';
import { Button } from '../../shared/components/Button';
import { supabase } from '../../shared/lib/supabase';
import { getApiBaseUrl, mapResetPasswordError } from '../../shared/utils/passwordRecovery';
import { useAuth } from '../../navigation/AuthContext';

type Props = {
  navigation: NavigationProp<ParamListBase>;
};

/**
 * Authenticated password change (POST /auth/reset-password).
 * Registered on every role stack; no role-specific logic.
 */
export function ResetPasswordScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await logout();
      }
    })();
  }, [logout]);

  const handleSubmit = async () => {
    if (loading || success || completedRef.current) return;

    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session expired. Please sign in again.');
        setLoading(false);
        await logout();
        return;
      }

      const url = `${getApiBaseUrl()}/auth/reset-password`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(mapResetPasswordError(typeof result?.error === 'string' ? result.error : undefined));
      }

      completedRef.current = true;
      setSuccess(true);
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 2000);
    } catch {
      setError('Something went wrong');
    } finally {
      if (!completedRef.current) {
        setLoading(false);
      }
    }
  };

  const locked = success || loading;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.subtitle}>Choose a strong password (at least 8 characters).</Text>

          {error ? (
            <View style={styles.bannerError} accessibilityLiveRegion="polite">
              <Text style={styles.bannerErrorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.bannerOk} accessibilityLiveRegion="polite">
              <Text style={styles.bannerOkText}>Password updated. Taking you back…</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <PasswordInput
                label="New password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                editable={!locked}
              />
              <PasswordInput
                label="Confirm password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                editable={!locked}
              />
              <Button
                title="Save password"
                onPress={handleSubmit}
                loading={loading}
                disabled={locked}
              />
            </View>
          )}

          <Button title="Cancel" variant="outline" onPress={() => navigation.goBack()} disabled={locked} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 20 },
  form: { gap: 4, marginBottom: 16 },
  bannerError: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  bannerErrorText: { color: '#b91c1c', fontSize: 14, fontWeight: '600' },
  bannerOk: {
    backgroundColor: '#ecfdf5',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  bannerOkText: { color: '#166534', fontSize: 14, fontWeight: '600' },
});
