import { useId, useState } from 'react';

function EyeOpenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
      />
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M1 1l22 22" />
    </svg>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  minLength,
  required,
  placeholder,
  disabled,
  id: idProp,
}: PasswordFieldProps) {
  const genId = useId();
  const inputId = idProp ?? `pwd-${genId}`;
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={inputId}>
      {label}
      <div className="password-field">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeOpenIcon />}
        </button>
      </div>
    </label>
  );
}
