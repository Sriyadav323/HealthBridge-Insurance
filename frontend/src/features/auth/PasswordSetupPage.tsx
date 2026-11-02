import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { mutateApiData } from '../../services/api';

export default function PasswordSetupPage({ reset = false }: { reset?: boolean }) {
  // A URL fragment never travels in HTTP requests/referrer headers. Remove it after capture.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') ?? '');
    if (password !== values.get('confirmation')) { setError('Passwords do not match.'); return; }
    if (new TextEncoder().encode(password).length > 72) { setError('Use at most 72 UTF-8 bytes.'); return; }
    setSaving(true); setError('');
    // Do not place the token in storage, query strings, telemetry, or logs.
    window.history.replaceState(null, '', window.location.pathname);
    try {
      await mutateApiData(reset ? '/auth/reset-password' : '/auth/password-setup', 'POST', { token, password });
      setComplete(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to set your password.'); }
    finally { setSaving(false); }
  }
  return <AuthLayout><div className="sign-in">
    <p className="form-eyebrow">YOUR ACCOUNT, YOUR ACCESS</p>
    <h1>{reset ? 'Reset your password' : 'Set up your member password'}</h1>
    {complete ? <><p role="status">{reset ? 'Password reset. Sign in with your new password. Existing sessions have been signed out.' : 'Password saved. Your member login is now enabled.'}</p><Link to="/">Continue to sign in</Link></> :
      <><p>Use 12 or more characters, up to 72 UTF-8 bytes. This private link expires after 30 minutes and works once.</p>
      {!token ? <p role="alert">{reset ? 'The reset link is missing. Request a new password reset link.' : 'The setup link is missing. Ask your administrator for a new link.'}</p> :
        <form onSubmit={submit} aria-busy={saving} className="auth-form">
          <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={saving} /></label>
          <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={saving} /></label>
          {error && <p role="alert">{error}</p>}
          <button className="auth-submit" disabled={saving}>{saving ? 'Saving password...' : 'Save password'}</button>
        </form>}
      <p><Link to="/">Back to sign in</Link></p>{reset && <p><Link to="/forgot-password">Request a new reset link</Link></p>}</>}
  </div></AuthLayout>;
}
