import AsyncStorage from '@react-native-async-storage/async-storage';

/** Shown after requesting an OTP — never implies the account exists. */
export const GENERIC_OTP_REQUEST_MESSAGE = 'If an account exists, an OTP has been sent';

export const RESEND_STORAGE_KEY = '@school_saas:forgot_otp_resend_until';

const COOLDOWN_MS = 45_000;

export function getApiBaseUrl(): string {
  const base = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_URL is required');
  }
  return base;
}

export async function readResendUntilMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(RESEND_STORAGE_KEY);
    if (!raw) return 0;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) ? until : 0;
  } catch {
    return 0;
  }
}

export async function writeResendCooldownFromNow(): Promise<void> {
  const until = Date.now() + COOLDOWN_MS;
  try {
    await AsyncStorage.setItem(RESEND_STORAGE_KEY, String(until));
  } catch {
    /* ignore */
  }
}

export async function clearResendUntil(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RESEND_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function cooldownSecondsRemaining(untilMs: number): number {
  if (untilMs <= Date.now()) return 0;
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}

/** Map backend-ish text to safe copy without echoing raw errors. */
export function mapVerifyErrorToMessage(backendError: string | undefined): string {
  const msg = (backendError || '').toLowerCase();
  if (!msg) return 'Could not reset password. Please try again.';
  if (msg.includes('expired')) return 'That code has expired. Please request a new code.';
  if (msg.includes('invalid')) return 'That code is not valid. Please check and try again, or request a new code.';
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('throttle') || msg.includes('too many') || msg.includes('429')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  return 'Could not reset password. Please try again.';
}

export function mapResetPasswordError(raw: string | undefined): string {
  const msg = (raw || '').toLowerCase();
  if (!msg) return 'Could not update your password. Please try again.';
  if (msg.includes('session') || msg.includes('jwt') || msg.includes('token') || msg.includes('unauthor')) {
    return 'Your session expired. Please sign in again.';
  }
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('short') || msg.includes('length'))) {
    return 'Password does not meet requirements. Use at least 8 characters.';
  }
  return 'Could not update your password. Please try again.';
}

/** Public POST (no bearer) for forgot-password-request. */
export async function postForgotPasswordRequest(endpointPath: string, body: Record<string, string>): Promise<void> {
  const url = `${getApiBaseUrl()}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('Could not send a code right now. Please try again.');
  }
}

/** Public POST for forgot-password-verify. */
export async function postForgotPasswordVerify(body: Record<string, string>): Promise<void> {
  const url = `${getApiBaseUrl()}/auth/forgot-password-verify`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(mapVerifyErrorToMessage(typeof result?.error === 'string' ? result.error : undefined));
  }
}
