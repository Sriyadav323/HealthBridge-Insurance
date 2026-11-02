
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AuthContext, sessionUser } from './AuthContext';
import type { SessionUser } from './AuthContext';
import AuthLayout from './AuthLayout';
import { ApiError, apiFetch, mutateApiData, SESSION_EXPIRED_EVENT } from '../../services/api';

export default function RequireSession({ children, onSignIn }: { children: ReactNode; onSignIn?: (account: SessionUser) => void }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const signedIn = user !== null;
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/v1/auth/me', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (controller.signal.aborted) return;

        if (response.ok) {
          const account = sessionUser(await response.json());
          if (!controller.signal.aborted) setUser(account);
        } else if (response.status !== 401 && response.status !== 403) {
          setError(`Session check failed (${response.status}).`);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Unable to connect to the server.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    function expired() {
      setUser(null);
      setError('Your session has expired. Please sign in again.');
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    async function checkSession() {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await apiFetch('/api/v1/auth/me', { signal: controller.signal });
        if (response.ok) {
          const account = sessionUser(await response.json());
          if (!controller.signal.aborted) setUser(account);
        }
      } catch {
        // A temporary network failure must not erase an authenticated session.
      }
    }
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', checkSession);
    return () => {
      controller.abort();
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, [signedIn]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fields = new FormData(event.currentTarget);
    setSubmitting(true);
    setError('');

    try {
      const account = await mutateApiData<SessionUser>('/auth/login', 'POST', {
        email: String(fields.get('email') ?? '').trim(),
        password: fields.get('password'),
      });

      const signedInAccount = sessionUser(account);
      onSignIn?.(signedInAccount);
      setUser(signedInAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setError('');

    try {
      await mutateApiData('/auth/logout', 'POST');

      setUser(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to sign out.');
      throw err;
    }
  }

  if (checking) {
    return <div className="session-loading"><span className="loading-ring" aria-hidden="true" /><p role="status">Checking your session...</p></div>;
  }

  if (!user) {
    return (
      <AuthLayout><div className="sign-in">
        <p className="form-eyebrow">WELCOME BACK</p>
        <h1>Sign in to HealthBridge</h1>
        <p className="form-intro">Sign in to manage your coverage, care, and account.</p>

        <form aria-busy={submitting} onSubmit={signIn} className="auth-form">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              disabled={submitting}
              required
            />
          </label>

          <div className="password-field">
            <label htmlFor="login-password">Password</label>
            <div className="password-control">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" disabled={submitting} required
                aria-describedby={capsLock ? 'caps-lock-hint' : undefined}
                onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))}
                onKeyDown={event => setCapsLock(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)} />
              <button type="button" className="password-toggle" disabled={submitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="login-password" aria-pressed={showPassword}
                onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            {capsLock && <p id="caps-lock-hint" className="field-hint">Caps Lock is on.</p>}
          </div>

          {error && <p role="alert">{error}</p>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting && <span className="button-spinner" aria-hidden="true" />}
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p><a href="/forgot-password">Forgot password?</a></p>
      </div></AuthLayout>
    );
  }

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {error && <p role="alert">{error}</p>}
      {children}
    </AuthContext.Provider>
  );
}
