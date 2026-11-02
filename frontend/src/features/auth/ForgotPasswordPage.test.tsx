import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import ForgotPasswordPage from './ForgotPasswordPage';
import PasswordSetupPage from './PasswordSetupPage';

it('requests recovery without disclosing account existence', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'csrf' })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'admin@example.com');
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If an eligible account exists');
  expect(fetch).toHaveBeenLastCalledWith('/api/v1/auth/forgot-password', expect.objectContaining({
    body: JSON.stringify({ email: 'admin@example.com' }),
    headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf' }),
  }));
});

it('shows configuration failures with an opportunity to retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'csrf' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Recovery unavailable' }), { status: 503 })));
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'member@example.com');
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Recovery unavailable');
  expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
});

it('resets passwords through the recovery endpoint and clears the fragment', async () => {
  window.history.replaceState(null, '', `/reset-password#token=${'B'.repeat(43)}`);
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'csrf' })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter><PasswordSetupPage reset /></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), 'new-long-password');
  await user.type(screen.getByLabelText('Confirm password'), 'new-long-password');
  await user.click(screen.getByRole('button', { name: 'Save password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Existing sessions have been signed out');
  expect(fetch).toHaveBeenLastCalledWith('/api/v1/auth/reset-password', expect.objectContaining({
    body: JSON.stringify({ token: 'B'.repeat(43), password: 'new-long-password' }),
  }));
  expect(window.location.hash).toBe('');
});
