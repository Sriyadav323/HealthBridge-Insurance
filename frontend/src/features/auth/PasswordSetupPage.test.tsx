import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import PasswordSetupPage from './PasswordSetupPage';

it('submits a fragment token with CSRF and clears it from the address bar', async () => {
  window.history.replaceState(null, '', `/set-password#token=${'A'.repeat(43)}`);
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'csrf' })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter><PasswordSetupPage /></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), 'synthetic-long-password');
  await user.type(screen.getByLabelText('Confirm password'), 'synthetic-long-password');
  await user.click(screen.getByRole('button', { name: 'Save password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Password saved');
  expect(window.location.hash).toBe('');
  expect(fetch).toHaveBeenLastCalledWith('/api/v1/auth/password-setup', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf' }),
    body: JSON.stringify({ token: 'A'.repeat(43), password: 'synthetic-long-password' }),
  }));
});

it('requires matching passwords and a setup link', async () => {
  window.history.replaceState(null, '', '/set-password');
  render(<MemoryRouter><PasswordSetupPage /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('setup link is missing');
  expect(screen.queryByRole('button', { name: 'Save password' })).not.toBeInTheDocument();
});

it('shows expired-link errors without enabling or signing in an account', async () => {
  window.history.replaceState(null, '', `/set-password#token=${'A'.repeat(43)}`);
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'csrf' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'This setup link is expired or already used.' }), { status: 400 }));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter><PasswordSetupPage /></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), 'synthetic-long-password');
  await user.type(screen.getByLabelText('Confirm password'), 'synthetic-long-password');
  await user.click(screen.getByRole('button', { name: 'Save password' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('expired or already used');
  expect(fetch.mock.calls.some(([path]) => path === '/api/v1/auth/login')).toBe(false);
});
