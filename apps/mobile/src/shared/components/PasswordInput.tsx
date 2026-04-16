import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  defaultHidden?: boolean;
}

export function PasswordInput({
  label,
  error,
  defaultHidden = true,
  style,
  editable = true,
  ...props
}: PasswordInputProps) {
  const [hidden, setHidden] = useState(defaultHidden);

  const a11yLabel = useMemo(() => (hidden ? 'Show password' : 'Hide password'), [hidden]);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputRow, error && styles.inputRowError, !editable && styles.inputRowDisabled]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor="#94a3b8"
          secureTextEntry={hidden}
          autoCapitalize="none"
          editable={editable}
          {...props}
        />
        <Pressable
          onPress={() => setHidden((h) => !h)}
          disabled={!editable}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: !editable }}
          style={styles.iconButton}
        >
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={editable ? '#64748b' : '#94a3b8'} />
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  inputRow: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRowError: {
    borderColor: '#ef4444',
  },
  inputRowDisabled: {
    backgroundColor: '#f8fafc',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});

