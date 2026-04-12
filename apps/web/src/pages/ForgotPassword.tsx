import { useEffect, useMemo, useRef, useState, FormEvent, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../utils/api';
import { OtpSixInput } from '../components/OtpSixInput';

/** Shown after requesting an OTP — never implies the account exists. */
const GENERIC_OTP_REQUEST_MESSAGE = 'If an account exists, an OTP has been sent';

const RESEND_COOLDOWN_SECONDS = 45;
const RESEND_STORAGE_KEY = 'school_saas_forgot_otp_resend_until';

function readStoredResendUntil(): number {
  try {
    const raw = localStorage.getItem(RESEND_STORAGE_KEY);
    if (!raw) return 0;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) ? until : 0;
  } catch {
    return 0;
  }
}

function writeStoredResendUntil(untilMs: number) {
  try {
    localStorage.setItem(RESEND_STORAGE_KEY, String(untilMs));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredResendUntil() {
  try {
    localStorage.removeItem(RESEND_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map backend-ish text to safe copy without echoing raw errors. */
function mapVerifyErrorToMessage(backendError: string | undefined): string {
  const msg = (backendError || '').toLowerCase();
  if (!msg) return 'Could not reset password. Please try again.';
  if (msg.includes('expired')) return 'That code has expired. Please request a new code.';
  if (msg.includes('invalid')) return 'That code is not valid. Please check and try again, or request a new code.';
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('throttle') || msg.includes('too many') || msg.includes('429'))
    return 'Too many attempts. Please wait a few minutes and try again.';
  return 'Could not reset password. Please try again.';
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'student' | 'email'>('student');
  const [step, setStep] = useState<1 | 2>(1);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  const passwordResetCompleteRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  /** Synchronous guard — blocks double-submit before `requestingOtp` state updates. */
  const otpRequestInFlightRef = useRef(false);

  useEffect(
    () => () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    },
    []
  );

  // Step 1: Request OTP
  const [username, setUsername] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [useRegistrationNumber, setUseRegistrationNumber] = useState(false);
  const [email, setEmail] = useState('');

  // Step 2: Verify OTP (string of up to 6 digits, synced with OtpSixInput)
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /** Wall-clock end of resend cooldown (ms); 0 = none. Kept in sync with localStorage for refresh + cross-tab. */
  const [resendUntilMs, setResendUntilMs] = useState(0);
  const resendUntilRef = useRef(0);
  useEffect(() => {
    resendUntilRef.current = resendUntilMs;
  }, [resendUntilMs]);

  const [cooldownTick, setCooldownTick] = useState(0);

  const syncResendUntilFromStorage = useCallback(() => {
    const until = readStoredResendUntil();
    if (until > Date.now()) {
      setResendUntilMs(until);
    } else {
      setResendUntilMs(0);
      if (until > 0) clearStoredResendUntil();
    }
  }, []);

  // Restore from localStorage (refresh); sync when another tab updates the same key
  useEffect(() => {
    syncResendUntilFromStorage();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RESEND_STORAGE_KEY) return;
      syncResendUntilFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncResendUntilFromStorage]);

  // Drive UI from Date.now() so display does not drift vs real time / tab throttling
  useEffect(() => {
    if (resendUntilMs <= Date.now()) return;
    const id = window.setInterval(() => {
      setCooldownTick((t) => t + 1);
      if (Date.now() >= resendUntilRef.current) {
        clearStoredResendUntil();
        setResendUntilMs(0);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendUntilMs]);

  const resendCooldown = useMemo(() => {
    if (resendUntilMs <= Date.now()) return 0;
    return Math.max(0, Math.ceil((resendUntilMs - Date.now()) / 1000));
  }, [resendUntilMs, cooldownTick]);

  const canResend = useMemo(
    () => resendCooldown <= 0 && !requestingOtp && step === 2 && !passwordResetComplete,
    [resendCooldown, requestingOtp, step, passwordResetComplete]
  );

  const formBusy = requestingOtp || verifyingOtp;
  const step2Locked = passwordResetComplete;

  const buildRequestOtpPayload = () => {
    if (mode === 'student') {
      if (!username.trim() || !schoolCode.trim()) {
        throw new Error('Username and school code are required');
      }
      const body: Record<string, string> = { username: username.trim() };
      if (useRegistrationNumber) body.registration_number = schoolCode;
      else body.join_code = schoolCode.toUpperCase();
      return { endpoint: `${API_URL}/auth/forgot-password-request`, body };
    }

    if (!email.trim()) {
      throw new Error('Email is required');
    }
    return {
      endpoint: `${API_URL}/auth/forgot-password-request-email`,
      body: { email: email.trim() }
    };
  };

  const startResendCooldown = () => {
    const until = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
    writeStoredResendUntil(until);
    setResendUntilMs(until);
  };

  const requestOtp = async () => {
    if (requestingOtp || otpRequestInFlightRef.current) return;
    otpRequestInFlightRef.current = true;
    setRequestingOtp(true);
    setError('');
    if (!step2Locked) setSuccess('');

    try {
      const { endpoint, body } = buildRequestOtpPayload();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error('Could not send a code right now. Please try again.');
      }

      // Always the same copy — do not use backend wording that might imply account existence.
      setSuccess(GENERIC_OTP_REQUEST_MESSAGE);
      setStep(2);
      startResendCooldown();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to request OTP';
      setError(message);
    } finally {
      otpRequestInFlightRef.current = false;
      setRequestingOtp(false);
    }
  };

  const handleRequestOTP = async (e: FormEvent) => {
    e.preventDefault();
    if (requestingOtp || otpRequestInFlightRef.current || passwordResetComplete) return;
    await requestOtp();
  };

  const handleResendClick = async () => {
    if (!canResend || requestingOtp || otpRequestInFlightRef.current) return;
    await requestOtp();
  };

  const handleVerifyOTP = async (e: FormEvent) => {
    e.preventDefault();
    if (verifyingOtp || passwordResetComplete) return;
    if (passwordResetCompleteRef.current) return;

    setVerifyingOtp(true);
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setVerifyingOtp(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setVerifyingOtp(false);
      return;
    }

    const otpDigits = otp.replace(/\D/g, '').slice(0, 6);
    if (otpDigits.length !== 6) {
      setError('Please enter the full 6-digit code');
      setVerifyingOtp(false);
      return;
    }

    try {
      const requestBody: Record<string, string> = {
        otp: otpDigits,
        new_password: newPassword,
      };

      if (mode === 'student') {
        requestBody.username = username.trim();
        if (useRegistrationNumber) {
          requestBody.registration_number = schoolCode;
        } else {
          requestBody.join_code = schoolCode.toUpperCase();
        }
      } else {
        requestBody.email = email.trim();
      }

      const response = await fetch(`${API_URL}/auth/forgot-password-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(mapVerifyErrorToMessage(typeof result?.error === 'string' ? result.error : undefined));
      }

      passwordResetCompleteRef.current = true;
      setPasswordResetComplete(true);
      setSuccess('Password reset successfully! Redirecting to login...');
      clearStoredResendUntil();
      setResendUntilMs(0);

      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        redirectTimerRef.current = null;
        navigate('/login');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h2>
            <p className="text-gray-600">
              {step === 1
                ? mode === 'student'
                  ? 'Enter your username and school code to receive an OTP'
                  : 'Enter your email to receive an OTP'
                : 'Enter the OTP sent to your email and set a new password'}
            </p>
          </div>

          {step === 1 && (
            <div className="mb-6 flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                disabled={formBusy || passwordResetComplete}
                onClick={() => {
                  setMode('student');
                  setUsername('');
                  setSchoolCode('');
                  setEmail('');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all disabled:opacity-50 ${
                  mode === 'student'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                disabled={formBusy || passwordResetComplete}
                onClick={() => {
                  setMode('email');
                  setUsername('');
                  setSchoolCode('');
                  setEmail('');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all disabled:opacity-50 ${
                  mode === 'email'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Principal/Teacher
              </button>
            </div>
          )}

          {error ? (
            <div
              className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          ) : null}

          {success ? (
            <div
              className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-green-700 text-sm font-medium">{success}</p>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <form
              onSubmit={handleRequestOTP}
              className="space-y-5"
              aria-busy={requestingOtp}
            >
              {mode === 'student' ? (
                <>
                  <div>
                    <label htmlFor="forgot-username" className="block text-sm font-semibold text-gray-700 mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        id="forgot-username"
                        type="text"
                        required
                        disabled={requestingOtp || passwordResetComplete}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter your username"
                        autoComplete="username"
                        aria-invalid={!!error && step === 1}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="forgot-school" className="block text-sm font-semibold text-gray-700">
                        School Code
                      </label>
                      <button
                        type="button"
                        disabled={requestingOtp || passwordResetComplete}
                        onClick={() => {
                          setUseRegistrationNumber(!useRegistrationNumber);
                          setSchoolCode('');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline disabled:opacity-50"
                      >
                        Use {useRegistrationNumber ? 'Join Code' : 'Registration Number'} instead
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <input
                        id="forgot-school"
                        type="text"
                        required
                        disabled={requestingOtp || passwordResetComplete}
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={useRegistrationNumber ? 'Enter school registration number' : 'Enter school join code'}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {useRegistrationNumber
                        ? "Enter your school's registration number"
                        : "Enter your school's join code"}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      disabled={requestingOtp || passwordResetComplete}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter your email address"
                      autoComplete="email"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the email address associated with your principal or teacher account
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={requestingOtp || passwordResetComplete}
                aria-busy={requestingOtp}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {requestingOtp ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending OTP...
                  </span>
                ) : (
                  'Send OTP'
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleVerifyOTP}
              className="space-y-5"
              aria-busy={verifyingOtp}
            >
              <div>
                <p id="forgot-otp-label" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                  OTP Code
                </p>
                <OtpSixInput
                  idPrefix="forgot-otp"
                  value={otp}
                  onChange={setOtp}
                  disabled={step2Locked || verifyingOtp}
                />
                <p className="mt-2 text-xs text-gray-500 text-center">Enter the 6-digit code from your email</p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!canResend || requestingOtp}
                  onClick={handleResendClick}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {requestingOtp ? 'Sending…' : canResend ? 'Resend code' : `Resend in ${resendCooldown}s`}
                </button>
                <button
                  type="button"
                  disabled={step2Locked || verifyingOtp}
                  onClick={() => {
                    setStep(1);
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                    setSuccess('');
                    clearStoredResendUntil();
                    setResendUntilMs(0);
                  }}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Change details
                </button>
              </div>

              <div>
                <label htmlFor="forgot-new-pass" className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="forgot-new-pass"
                    type="password"
                    required
                    disabled={step2Locked || verifyingOtp}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter new password (min. 8 characters)"
                    minLength={8}
                    autoComplete="new-password"
                    aria-invalid={!!error && step === 2}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Password must be at least 8 characters long</p>
              </div>

              <div>
                <label htmlFor="forgot-confirm-pass" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="forgot-confirm-pass"
                    type="password"
                    required
                    disabled={step2Locked || verifyingOtp}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Confirm new password"
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={step2Locked || verifyingOtp}
                  onClick={() => {
                    setStep(1);
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                    setSuccess('');
                    clearStoredResendUntil();
                    setResendUntilMs(0);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={step2Locked || verifyingOtp}
                  aria-busy={verifyingOtp}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {verifyingOtp ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resetting Password...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition text-sm inline-block py-2"
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
