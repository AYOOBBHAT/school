import { useRef, KeyboardEvent, ClipboardEvent } from 'react';

type OtpSixInputProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Prefix for stable ids / aria (e.g. forgot-otp) */
  idPrefix: string;
};

/**
 * Six OTP cells: numeric-only, auto-advance, backspace, arrow keys, paste full code.
 * Model: OTP is a left-to-right string; cell i shows otp[i] when i < length, else empty.
 */
export function OtpSixInput({ value, onChange, disabled, idPrefix }: OtpSixInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const normalized = value.replace(/\D/g, '').slice(0, 6);
  const cells = Array.from({ length: 6 }, (_, i) => (i < normalized.length ? normalized[i] : ''));

  const focusAt = (index: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(5, index))];
    el?.focus();
    el?.select();
  };

  const handleChangeAt = (index: number, raw: string) => {
    if (disabled) return;
    const o = value.replace(/\D/g, '').slice(0, 6);

    // Paste or multi-char from mobile keyboards
    const batch = raw.replace(/\D/g, '');
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

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const o = value.replace(/\D/g, '').slice(0, 6);

    if (e.key === 'Backspace') {
      if (!cells[index] && index > 0) {
        e.preventDefault();
        focusAt(index - 1);
        const next = o.slice(0, index - 1) + o.slice(index);
        onChange(next);
      } else if (cells[index]) {
        e.preventDefault();
        const next = o.slice(0, index) + o.slice(index + 1);
        onChange(next);
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const next = text.replace(/\D/g, '').slice(0, 6);
    onChange(next);
    focusAt(Math.min(next.length, 5));
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="One-time code">
      {cells.map((ch, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={ch}
          aria-label={`Digit ${i + 1} of 6`}
          className="w-11 h-12 text-center text-xl font-mono font-semibold border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          onChange={(e) => handleChangeAt(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
