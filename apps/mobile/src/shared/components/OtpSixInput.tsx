import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Platform,
} from 'react-native';

type OtpSixInputProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

/**
 * Six OTP cells — numeric, auto-advance, backspace, paste (full code into any cell).
 */
export function OtpSixInput({ value, onChange, disabled }: OtpSixInputProps) {
  const inputsRef = useRef<(TextInput | null)[]>([]);
  const normalized = value.replace(/\D/g, '').slice(0, 6);
  const cells = Array.from({ length: 6 }, (_, i) => (i < normalized.length ? normalized[i] : ''));

  const focusAt = (index: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(5, index))];
    el?.focus();
  };

  const applyAt = (index: number, raw: string) => {
    if (disabled) return;
    const batch = raw.replace(/\D/g, '');
    const o = value.replace(/\D/g, '').slice(0, 6);

    if (batch.length > 1) {
      const next = batch.slice(0, 6);
      onChange(next);
      focusAt(Math.min(next.length, 5));
      return;
    }

    if (batch === '') {
      const next = o.slice(0, index) + o.slice(index + 1);
      onChange(next);
      return;
    }

    const d = batch.slice(-1);
    const next = (o.slice(0, index) + d + o.slice(index + 1)).slice(0, 6);
    onChange(next);
    if (index < 5) focusAt(index + 1);
  };

  const onKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (disabled) return;
    const key = e.nativeEvent.key;
    const o = value.replace(/\D/g, '').slice(0, 6);

    if (key === 'Backspace') {
      if (!cells[index] && index > 0) {
        const next = o.slice(0, index - 1) + o.slice(index);
        onChange(next);
        focusAt(index - 1);
      } else if (cells[index]) {
        const next = o.slice(0, index) + o.slice(index + 1);
        onChange(next);
      }
    }
  };

  return (
    <View style={styles.row} accessibilityLabel="One-time code, 6 digits">
      {cells.map((ch, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          style={[styles.cell, disabled && styles.cellDisabled]}
          value={ch}
          onChangeText={(t) => applyAt(i, t)}
          onKeyPress={(e) => onKeyPress(i, e)}
          keyboardType="number-pad"
          maxLength={6}
          editable={!disabled}
          selectTextOnFocus
          accessibilityLabel={`Digit ${i + 1} of 6`}
          {...(i === 0 && Platform.OS === 'ios' ? { textContentType: 'oneTimeCode' as const } : {})}
          {...(i === 0 && Platform.OS === 'android' ? { autoComplete: 'sms-otp' as const } : {})}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cell: {
    width: 44,
    height: 48,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  cellDisabled: {
    opacity: 0.5,
  },
});
