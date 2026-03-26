import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/api';
import { PasswordField } from '../components/PasswordField';

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+2250100000000');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState('');

  if (!loading && (user || getToken())) {
    return <Navigate to="/app" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(phone, password);
      navigate('/app', { replace: true });
    } catch {
      setError('Identifiants invalides ou compte désactivé.');
    }
  }

  return (
    <main className="login-page">
      <div className="auth-card card">
        <h1 className="login-title">Connexion</h1>
        <p className="login-sub">Point de vente — accès sécurisé par rôle</p>
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Numéro de téléphone
            <input
              type="tel"
              inputMode="tel"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225…"
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
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  );
}
