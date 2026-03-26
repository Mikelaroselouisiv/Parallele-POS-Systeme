import { useState } from 'react';
import type { FormEvent } from 'react';
import { PasswordField } from './PasswordField';

interface LoginFormProps {
  onSubmit: (phone: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, loading, error }: LoginFormProps) {
  const [phone, setPhone] = useState('+2250100000000');
  const [password, setPassword] = useState('admin1234');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(phone, password);
  };

  return (
    <div className="card auth-card">
      <h1>POS Desktop Login</h1>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Numéro de téléphone
          <input
            type="tel"
            inputMode="tel"
            autoComplete="username"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </label>
        <PasswordField
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
