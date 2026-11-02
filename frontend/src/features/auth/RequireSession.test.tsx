import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RequireSession from './RequireSession';
import { useAuth } from './AuthContext';
import { apiFetch } from '../../services/api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function ProtectedPage() {
  const { signOut } = useAuth();
  return <><p>Protected member information</p><button onClick={() => void signOut()}>Logout</button></>;
}

describe('session boundary', () => {
  it('hides member information until the session check completes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401)));
    render(<RequireSession><ProtectedPage /></RequireSession>);
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    expect(screen.queryByText('Protected member information')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  it('submits login with CSRF then displays the protected page', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ token: 'login-token' }))
      .mockResolvedValueOnce(json({ memberId: 'SYNTHETIC-A', roles: ['MEMBER'] }));
    vi.stubGlobal('fetch', fetch);
    render(<RequireSession><ProtectedPage /></RequireSession>);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'synthetic-test-input');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Protected member information')).toBeVisible();
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/auth/login', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'login-token' }),
    }));
  });

  it('shows a failed login without exposing protected content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ token: 'token' }))
      .mockResolvedValueOnce(json({ message: 'Invalid email or password' }, 401)));
    render(<RequireSession><ProtectedPage /></RequireSession>);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'incorrect');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByText('Protected member information')).not.toBeInTheDocument();
  });

  it('unmounts all member content on session expiration', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ memberId: 'SYNTHETIC-A', roles: ['MEMBER'] })).mockResolvedValueOnce(json({}, 401));
    vi.stubGlobal('fetch', fetch);
    render(<RequireSession><ProtectedPage /></RequireSession>);
    await screen.findByText('Protected member information');
    await act(async () => { await apiFetch('/api/v1/members/me/claims'); });
    expect(await screen.findByRole('alert')).toHaveTextContent('session has expired');
    expect(screen.queryByText('Protected member information')).not.toBeInTheDocument();
  });

  it('logs out with a fresh CSRF token and removes protected content', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ memberId: 'SYNTHETIC-A', roles: ['MEMBER'] }))
      .mockResolvedValueOnce(json({ token: 'logout-token' })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    render(<RequireSession><ProtectedPage /></RequireSession>);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Logout' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByText('Protected member information')).not.toBeInTheDocument();
  });
});

it('rechecks the session on browser focus and removes expired member content', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({ memberId: 'SYNTHETIC-A', roles: ['MEMBER'] }))
    .mockResolvedValueOnce(json({ code: 'UNAUTHENTICATED' }, 401));
  vi.stubGlobal('fetch', fetch);
  render(<RequireSession><ProtectedPage /></RequireSession>);
  await screen.findByText('Protected member information');
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(await screen.findByRole('alert')).toHaveTextContent('session has expired');
  expect(screen.queryByText('Protected member information')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith('/api/v1/auth/me', expect.objectContaining({ credentials: 'same-origin' }));
});

it('keeps passwords hidden by default and toggles visibility without submitting', async () => {
  const fetch = vi.fn().mockResolvedValue(json({}, 401));
  vi.stubGlobal('fetch', fetch);
  render(<RequireSession><ProtectedPage /></RequireSession>);
  const input = await screen.findByLabelText('Password');
  const user = userEvent.setup();
  expect(input).toHaveAttribute('type', 'password');
  await user.type(input, 'synthetic-visibility-check');
  await user.click(screen.getByRole('button', { name: 'Show password' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('synthetic-visibility-check');
  await user.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(input).toHaveAttribute('type', 'password');
  expect(fetch).toHaveBeenCalledTimes(1);
});
