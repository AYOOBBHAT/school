import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Input } from '../shared/components/Input';
import { Button } from '../shared/components/Button';
import { OtpSixInput } from '../shared/components/OtpSixInput';
import {
  GENERIC_OTP_REQUEST_MESSAGE,
  readResendUntilMs,
  writeResendCooldownFromNow,
  clearResendUntil,
  cooldownSecondsRemaining,
  postForgotPasswordRequest,
  postForgotPasswordVerify,
} from '../shared/utils/passwordRecovery';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'student' | 'email'>('student');
  const [step, setStep] = useState<1 | 2>(1);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  const passwordResetCompleteRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Synchronous guard — blocks double-tap before `requestingOtp` state updates. */
  const otpRequestInFlightRef = useRef(false);

  useEffect(
    () => () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    },
    []
  );

  const [username, setUsername] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [useRegistrationNumber, setUseRegistrationNumber] = useState(false);
  const [email, setEmail] = useState('');

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [resendUntilMs, setResendUntilMs] = useState(0);
  const resendUntilRef = useRef(0);
  useEffect(() => {
    resendUntilRef.current = resendUntilMs;
  }, [resendUntilMs]);

  const [cooldownTick, setCooldownTick] = useState(0);

  const hydrateCooldown = useCallback(async () => {
    const until = await readResendUntilMs();
    if (until > Date.now()) {
      setResendUntilMs(until);
    } else {
      setResendUntilMs(0);
      if (until > 0) await clearResendUntil();
    }
  }, []);

  useEffect(() => {
    hydrateCooldown();
  }, [hydrateCooldown]);

  // After kill/restart or long background: re-read stored cooldown end time
  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') hydrateCooldown();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [hydrateCooldown]);

  useEffect(() => {
    if (resendUntilMs <= Date.now()) return;
    const id = setInterval(() => {
      setCooldownTick((t) => t + 1);
      if (Date.now() >= resendUntilRef.current) {
        clearResendUntil();
        setResendUntilMs(0);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [resendUntilMs]);

  const resendCooldown = useMemo(() => {
    if (resendUntilMs <= Date.now()) return 0;
    return cooldownSecondsRemaining(resendUntilMs);
  }, [resendUntilMs, cooldownTick]);

  const canResend = useMemo(
    () => resendCooldown <= 0 && !requestingOtp && step === 2 && !passwordResetComplete,
    [resendCooldown, requestingOtp, step, passwordResetComplete]
  );

  const buildRequestBody = (): { path: string; body: Record<string, string> } => {
    if (mode === 'student') {
      if (!username.trim() || !schoolCode.trim()) {
        throw new Error('Username and school code are required');
      }
      const body: Record<string, string> = { username: username.trim() };
      if (useRegistrationNumber) body.registration_number = schoolCode;
      else body.join_code = schoolCode.toUpperCase();
      return { path: '/auth/forgot-password-request', body };
    }
    if (!email.trim()) {
      throw new Error('Email is required');
    }
    return { path: '/auth/forgot-password-request-email', body: { email: email.trim() } };
  };

  const requestOtp = async () => {
    if (requestingOtp || otpRequestInFlightRef.current) return;
    otpRequestInFlightRef.current = true;
    setRequestingOtp(true);
    setError('');
    if (!passwordResetComplete) setInfo('');

    try {
      const { path, body } = buildRequestBody();
      await postForgotPasswordRequest(path, body);
      setInfo(GENERIC_OTP_REQUEST_MESSAGE);
      setStep(2);
      await writeResendCooldownFromNow();
      const until = await readResendUntilMs();
      if (until > Date.now()) setResendUntilMs(until);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to request code';
      setError(message);
    } finally {
      otpRequestInFlightRef.current = false;
      setRequestingOtp(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || requestingOtp || otpRequestInFlightRef.current) return;
    await requestOtp();
  };

  const handleVerify = async () => {
    if (verifyingOtp || passwordResetComplete) return;
    if (passwordResetCompleteRef.current) return;

    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const otpDigits = otp.replace(/\D/g, '').slice(0, 6);
    if (otpDigits.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setVerifyingOtp(true);
    try {
      const body: Record<string, string> = {
        otp: otpDigits,
        new_password: newPassword,
      };
      if (mode === 'student') {
        body.username = username.trim();
        if (useRegistrationNumber) body.registration_number = schoolCode;
        else body.join_code = schoolCode.toUpperCase();
      } else {
        body.email = email.trim();
      }

      await postForgotPasswordVerify(body);
      passwordResetCompleteRef.current = true;
      setPasswordResetComplete(true);
      setInfo('Password reset successfully! You can sign in with your new password.');
      await clearResendUntil();
      setResendUntilMs(0);
      if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null;
        navigation.navigate('Login');
      }, 2000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to reset password';
      setError(message);
    } finally {
      if (!passwordResetCompleteRef.current) {
        setVerifyingOtp(false);
      }
    }
  };

  const step2Locked = passwordResetComplete;
  const formBusy = requestingOtp || verifyingOtp;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? mode === 'student'
                ? 'Enter your username and school code'
                : 'Enter your work email'
              : 'Enter the code from your email and choose a new password'}
          </Text>

          {step === 1 && (
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === 'student' && styles.toggleBtnOn]}
                disabled={formBusy || passwordResetComplete}
                onPress={() => {
                  setMode('student');
                  setUsername('');
                  setSchoolCode('');
                  setEmail('');
                  setError('');
                  setInfo('');
                }}
              >
                <Text style={[styles.toggleText, mode === 'student' && styles.toggleTextOn]}>Student</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === 'email' && styles.toggleBtnOn]}
                disabled={formBusy || passwordResetComplete}
                onPress={() => {
                  setMode('email');
                  setUsername('');
                  setSchoolCode('');
                  setEmail('');
                  setError('');
                  setInfo('');
                }}
              >
                <Text style={[styles.toggleText, mode === 'email' && styles.toggleTextOn]}>Staff</Text>
              </TouchableOpacity>
            </View>
          )}

          {error ? (
            <View style={styles.bannerError} accessibilityLiveRegion="polite">
              <Text style={styles.bannerErrorText}>{error}</Text>
            </View>
          ) : null}

          {info ? (
            <View style={styles.bannerOk} accessibilityLiveRegion="polite">
              <Text style={styles.bannerOkText}>{info}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.form}>
              {mode === 'student' ? (
                <>
                  <Input
                    label="Username"
                    placeholder="Student username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!formBusy && !passwordResetComplete}
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                      {useRegistrationNumber ? 'Registration number' : 'Join code'}
                    </Text>
                    <TouchableOpacity
                      disabled={formBusy || passwordResetComplete}
                      onPress={() => {
                        setUseRegistrationNumber(!useRegistrationNumber);
                        setSchoolCode('');
                      }}
                    >
                      <Text style={styles.switchLink}>
                        Use {useRegistrationNumber ? 'join code' : 'registration number'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Input
                    placeholder={useRegistrationNumber ? 'School registration number' : 'School join code'}
                    value={schoolCode}
                    onChangeText={(t) => setSchoolCode(t.toUpperCase())}
                    autoCapitalize="characters"
                    editable={!formBusy && !passwordResetComplete}
                  />
                </>
              ) : (
                <Input
                  label="Email"
                  placeholder="Work email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!formBusy && !passwordResetComplete}
                />
              )}
              <Button
                title="Send code"
                onPress={() => {
                  if (requestingOtp || otpRequestInFlightRef.current || passwordResetComplete) return;
                  void requestOtp();
                }}
                loading={requestingOtp}
                disabled={requestingOtp || passwordResetComplete}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.otpLabel}>6-digit code</Text>
              <OtpSixInput value={otp} onChange={setOtp} disabled={step2Locked || verifyingOtp} />

              <View style={styles.resendRow}>
                <TouchableOpacity
                  disabled={!canResend || requestingOtp}
                  onPress={handleResend}
                  accessibilityState={{ disabled: !canResend || requestingOtp }}
                >
                  <Text style={[styles.link, (!canResend || requestingOtp) && styles.linkDisabled]}>
                    {requestingOtp ? 'Sending…' : canResend ? 'Resend code' : `Resend in ${resendCooldown}s`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={step2Locked || verifyingOtp}
                  onPress={async () => {
                    setStep(1);
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                    setInfo('');
                    await clearResendUntil();
                    setResendUntilMs(0);
                  }}
                >
                  <Text style={styles.linkMuted}>Change details</Text>
                </TouchableOpacity>
              </View>

              <Input
                label="New password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!step2Locked && !verifyingOtp}
              />
              <Input
                label="Confirm password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!step2Locked && !verifyingOtp}
              />

              <View style={styles.rowBtns}>
                <View style={styles.flexBtn}>
                  <Button
                    title="Back"
                    variant="outline"
                    onPress={async () => {
                      setStep(1);
                      setOtp('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setError('');
                      setInfo('');
                      await clearResendUntil();
                      setResendUntilMs(0);
                    }}
                    disabled={step2Locked || verifyingOtp}
                  />
                </View>
                <View style={styles.flexBtn}>
                  <Button
                    title="Reset password"
                    onPress={handleVerify}
                    loading={verifyingOtp}
                    disabled={step2Locked || verifyingOtp}
                  />
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.backLogin} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.backLoginText}>← Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 20 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  toggleBtnOn: { backgroundColor: '#fff' },
  toggleText: { fontWeight: '600', color: '#64748b' },
  toggleTextOn: { color: '#2563eb' },
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
  form: { gap: 4 },
  otpLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
  },
  link: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  linkDisabled: { color: '#94a3b8' },
  linkMuted: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  switchLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  switchLink: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  rowBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  flexBtn: { flex: 1 },
  backLogin: { marginTop: 28, alignItems: 'center', paddingVertical: 12 },
  backLoginText: { fontSize: 15, fontWeight: '700', color: '#2563eb' },
});
