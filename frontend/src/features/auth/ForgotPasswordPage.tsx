import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { mutateApiData } from '../../services/api';

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setBusy(true); setError('');
    try { await mutateApiData('/auth/forgot-password', 'POST', { email }); setSent(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to request a reset link.'); }
    finally { setBusy(false); }
  }
  return <AuthLayout><div className="sign-in">
    <p className="form-eyebrow">ACCOUNT RECOVERY</p>
    <h1>Forgot your password?</h1>
    <p>Enter the email for your member or administrator account.</p>
    {sent ? <p role="status">If an eligible account exists for this email, you will receive a password reset link. Check your inbox and spam folder. The link expires in 30 minutes. You can request another after one minute.</p> :
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <label>Email<input name="email" type="email" autoComplete="email" maxLength={255} required disabled={busy} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Requesting link...' : 'Send reset link'}</button>
      </form>}
    <p><Link to="/">Back to sign in</Link></p>
  </div></AuthLayout>;
}
