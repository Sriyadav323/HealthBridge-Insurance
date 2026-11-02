import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, it, expect, vi } from 'vitest';
import App from './App';
import { benefitsData } from './features/benefits/data/benefitsData';
import { claimsData } from './features/claims/data/claimsData';
import { providersData } from './features/providers/data/providersData';

beforeEach(() => {
  const fixtures: Record<string, unknown> = {
    '/api/v1/auth/me': { memberId: benefitsData.memberId, roles: ['MEMBER'] },
    '/api/v1/members/me/benefits': benefitsData,
    '/api/v1/members/me/claims': claimsData,
    '/api/v1/providers': providersData,
    '/api/v1/members/me/profile': { memberId: benefitsData.memberId, fullName: benefitsData.memberName,
      email: 'synthetic@example.com', phone: null, address: null, planName: benefitsData.planName,
      planType: benefitsData.planType, coverageStatus: benefitsData.coverageStatus },
    '/api/v1/members/me/prescriptions': [],
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!(url in fixtures)) throw new Error(`Unexpected test request: ${url}`);
    return new Response(JSON.stringify(fixtures[url]));
  }));
});

it.each([
  ['/dashboard', 'Welcome back, John!'],
  ['/benefits', 'My Benefits'],
  ['/claims', 'My Claims'],
  ['/providers', 'Find a Doctor'],
  ['/id-card', 'Digital ID Card'],
  ['/profile', 'My Profile'],
  ['/pharmacy', 'Pharmacy & Prescriptions'],
  ['/missing', 'Page not found'],
])('renders authenticated route %s under React StrictMode', async (path, title) => {
  window.history.replaceState(null, '', path);
  render(<StrictMode><App /></StrictMode>);
  expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeVisible();
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('navigates between features without hook-order failures', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  window.history.replaceState(null, '', '/dashboard');
  render(<App />);
  await screen.findByRole('heading', { name: 'Welcome back, John!' });
  const user = userEvent.setup();
  for (const name of ['My Claims', 'Find a Doctor', 'My Benefits', 'My Profile', 'Pharmacy & Prescriptions', 'Digital ID Card']) {
    await user.click(screen.getByRole('link', { name }));
    expect(await screen.findByRole('heading', { name, level: 1 })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

it.each(['/benefits', '/dashboard', '/id-card'])('does not show unconfigured or obsolete benefit amounts at %s', async path => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/v1/auth/me') return new Response(JSON.stringify({ memberId: benefitsData.memberId, roles: ['MEMBER'] }));
    if (url === '/api/v1/members/me/benefits') return new Response(JSON.stringify({ ...benefitsData, benefitsConfigured: false }));
    if (url === '/api/v1/members/me/claims') return new Response('[]');
    throw new Error('Unexpected request');
  }));
  window.history.replaceState(null, '', path);
  render(<App />);
  await screen.findByRole('navigation', { name: 'Main navigation' });
  await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText('$900 met')).not.toBeInTheDocument();
  expect(screen.queryByText('$25 Copay')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Deductible' })).not.toBeInTheDocument();
});
