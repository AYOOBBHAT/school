import { Eye, EyeOff } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Visible label text rendered above the input */
  label?: string;
  /** Optional className applied to the outer wrapper */
  wrapperClassName?: string;
};

export function PasswordInput({ label, className, wrapperClassName, id, ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const toggleLabel = useMemo(() => (visible ? 'Hide password' : 'Show password'), [visible]);

  return (
    <div className={wrapperClassName}>
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`w-full pr-12 ${className ?? ''}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          aria-pressed={visible}
          disabled={props.disabled}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

