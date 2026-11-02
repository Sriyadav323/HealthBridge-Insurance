import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import App from '../../App';
import { benefitsData } from '../benefits/data/benefitsData';
import type { MemberDetails, MemberSummary, MemberWrite } from './types/admin.types';

const member: MemberSummary = { memberId: 'SYNTHETIC-1', fullName: 'Synthetic Member', email: 'member@example.com', phone: '555-0101', planName: 'Demo PPO', planType: 'PPO', coverageStatus: 'Active', accountEnabled: true, passwordSetupRequired: false, registeredAt: '2026-10-31T12:00:00Z', version: 0 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function api(role: 'ADMIN' | 'MEMBER' = 'ADMIN') {
  let details: MemberDetails = { summary: { ...member }, address: 'Synthetic address' };
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const path = url.pathname;
    if (path === '/api/v1/auth/me') return json({ memberId: 'ACCOUNT', roles: [role] });
    if (path === '/api/v1/auth/csrf') return json({ token: 'csrf-token' });
    if (path === '/api/v1/admin/plans') return json([{ planName: 'Demo PPO', planType: 'PPO' }, { planName: 'Demo HMO', planType: 'HMO' }]);
    if (path === '/api/v1/admin/dashboard') return json({ totalMembers: 12, activeMembers: 9, inactiveMembers: 3, enabledAccounts: 8, recentRegistrations: [member] });
    if (path === '/api/v1/members/me/benefits') return json(benefitsData);
    if (path === '/api/v1/members/me/claims') return json([]);
    if (path === '/api/v1/admin/members' && init?.method === 'POST') {
      const fields = JSON.parse(init.body as string) as MemberWrite;
      return json({ details: { summary: { ...member, ...fields, accountEnabled: false, passwordSetupRequired: true }, address: fields.address }, setupToken: 'A'.repeat(43), setupExpiresAt: '2026-10-31T12:30:00Z' }, 201);
    }
    if (path === '/api/v1/admin/members') return json({ items: [member], totalElements: 12, totalPages: 2, page: Number(url.searchParams.get('page') ?? 0), size: 10 });
    if (path === `/api/v1/admin/members/${member.memberId}/account`) {
      details = { ...details, summary: { ...details.summary, accountEnabled: false, version: 1 } };
      return json(details);
    }
    if (path === `/api/v1/admin/members/${member.memberId}`) return json(details);
    throw new Error(`Unexpected test request ${path}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function start(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

it('redirects administrators to the admin dashboard and displays only admin navigation', async () => {
  api(); start('/');
  expect(await screen.findByRole('heading', { level: 1, name: 'Admin Dashboard' })).toBeVisible();
  expect(await screen.findByText('12')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Member Management' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'My Claims' })).not.toBeInTheDocument();
});

it('prevents members from rendering admin routes or requesting admin data', async () => {
  const fetch = api('MEMBER'); start('/admin/members');
  expect(await screen.findByRole('heading', { name: 'Welcome back, John!' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Member Management' })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([path]) => path.startsWith('/api/v1/admin'))).toBe(false);
});

it('prevents an admin-only account from entering the member portal', async () => {
  api(); start('/claims');
  expect(await screen.findByRole('heading', { level: 1, name: 'Admin Dashboard' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'My Claims' })).not.toBeInTheDocument();
});

it('sends search, coverage/account filters, and pagination to the server', async () => {
  const fetch = api(); start('/admin/members');
  const user = userEvent.setup();
  await screen.findByRole('link', { name: 'View and edit Synthetic Member' });
  await user.type(screen.getByLabelText('Search members'), 'Synthetic');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(fetch.mock.calls.some(([path]) => new URL(path, 'http://localhost').searchParams.get('search') === 'Synthetic')).toBe(true));
  await user.selectOptions(screen.getByLabelText('Coverage status'), 'Active');
  await user.selectOptions(screen.getByLabelText('Login account status'), 'enabled');
  await user.click(await screen.findByRole('button', { name: 'Next' }));
  await waitFor(() => expect(fetch.mock.calls.some(([path]) => {
    const params = new URL(path, 'http://localhost').searchParams;
    return params.get('page') === '1' && params.get('account') === 'enabled' && params.get('coverage') === 'Active';
  })).toBe(true));
});

it('registers without role/password fields and displays the private setup link once', async () => {
  const fetch = api(); start('/admin/members/new');
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Full name'), 'New Synthetic Member');
  await user.type(screen.getByLabelText('Email address'), 'new@example.com');
  await screen.findByRole('option', { name: 'Demo PPO · PPO' });
  await user.selectOptions(screen.getByLabelText('Insurance plan'), JSON.stringify(['Demo PPO', 'PPO']));
  await user.click(screen.getByRole('button', { name: 'Register member' }));
  expect(await screen.findByRole('status')).toHaveTextContent('registered successfully');
  expect(screen.getByLabelText('One-time setup link')).toHaveValue(`${window.location.origin}/set-password#token=${'A'.repeat(43)}`);
  const registration = fetch.mock.calls.find(([path, init]) => path === '/api/v1/admin/members' && init?.method === 'POST');
  const fields = JSON.parse(registration?.[1]?.body as string) as Record<string, unknown>;
  expect(fields).not.toHaveProperty('role');
  expect(fields).not.toHaveProperty('password');
});

it('requires confirmation before disabling an account and reloads the updated status', async () => {
  const fetch = api(); start(`/admin/members/${member.memberId}`);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Disable login' }));
  expect(fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Disable login' }));
  expect(await screen.findByText('Login disabled.')).toBeVisible();
  expect(await screen.findByRole('button', { name: 'Enable login' })).toBeVisible();
  expect(fetch).toHaveBeenCalledWith(`/api/v1/admin/members/${member.memberId}/account`, expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ enabled: false, version: 0 }) }));
});

it('shows a registration conflict while keeping entered fields', async () => {
  const fetch = api();
  fetch.mockImplementation(async (path, init) => {
    if (path === '/api/v1/auth/me') return json({ memberId: 'ADMIN', roles: ['ADMIN'] });
    if (path === '/api/v1/auth/csrf') return json({ token: 'csrf' });
    if (path === '/api/v1/admin/plans') return json([{ planName: 'Demo PPO', planType: 'PPO' }]);
    if (init?.method === 'POST') return json({ message: 'An account already uses that email.' }, 409);
    throw new Error('Unexpected request');
  });
  start('/admin/members/new');
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Full name'), 'Synthetic Member');
  await user.type(screen.getByLabelText('Email address'), 'duplicate@example.com');
  await screen.findByRole('option', { name: 'Demo PPO · PPO' });
  await user.selectOptions(screen.getByLabelText('Insurance plan'), JSON.stringify(['Demo PPO', 'PPO']));
  await user.click(screen.getByRole('button', { name: 'Register member' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already uses that email');
  expect(screen.getByLabelText('Email address')).toHaveValue('duplicate@example.com');
});

it('uses the selected existing plan and fills in its matching type', async () => {
  const fetch = api(); start('/admin/members/new');
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Full name'), 'Plan Selection Member');
  await user.type(screen.getByLabelText('Email address'), 'selection@example.com');
  await screen.findByRole('option', { name: 'Demo HMO · HMO' });
  await user.selectOptions(screen.getByLabelText('Insurance plan'), JSON.stringify(['Demo HMO', 'HMO']));
  expect(screen.getByLabelText('Plan type')).toHaveValue('HMO');
  expect(screen.getByLabelText('Plan type')).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Register member' }));
  expect(await screen.findByRole('status')).toHaveTextContent('registered successfully');
  const call = fetch.mock.calls.find(([path, init]) => path === '/api/v1/admin/members' && init?.method === 'POST');
  expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({ planName: 'Demo HMO', planType: 'HMO' });
});

it('lets administrators change plan type and choose a matching plan', async () => {
  api(); start('/admin/members/new');
  const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Demo PPO · PPO' });
  await user.selectOptions(screen.getByLabelText('Insurance plan'), JSON.stringify(['Demo PPO', 'PPO']));
  await user.selectOptions(screen.getByLabelText('Plan type'), 'HMO');
  expect(screen.getByLabelText('Insurance plan')).toHaveValue('');
  expect(screen.queryByRole('option', { name: 'Demo PPO · PPO' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Register member' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Insurance plan'), JSON.stringify(['Demo HMO', 'HMO']));
  expect(screen.getByLabelText('Plan type')).toHaveValue('HMO');
});

it('keeps logout in the sidebar and removes the workspace header controls', async () => {
  api(); start('/admin');
  await screen.findByRole('heading', { level: 1, name: 'Admin Dashboard' });
  expect(screen.queryByText('Admin workspace')).not.toBeInTheDocument();
  const logout = screen.getByRole('button', { name: 'Logout' });
  expect(logout.closest('nav')).toHaveAttribute('aria-label', 'Main navigation');
  expect(logout.closest('header')).toBeNull();
});

it.each(['ADMIN', 'MEMBER'] as const)('opens the %s dashboard first after login from a nested URL', async role => {
  const fetch = api(role);
  const original = fetch.getMockImplementation()!;
  let signedIn = false;
  fetch.mockImplementation(async (path, init) => {
    if (path === '/api/v1/auth/me' && !signedIn) return json({}, 401);
    if (path === '/api/v1/auth/login') {
      signedIn = true;
      return json({ memberId: 'ACCOUNT', roles: [role] });
    }
    return original(path, init);
  });
  start(role === 'ADMIN' ? '/admin/members' : '/claims');
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), 'synthetic@example.com');
  await user.type(screen.getByLabelText('Password'), 'synthetic-test-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('heading', { level: 1, name: role === 'ADMIN' ? 'Admin Dashboard' : 'Welcome back, John!' })).toBeVisible();
  expect(window.location.pathname).toBe(role === 'ADMIN' ? '/admin' : '/dashboard');
});

it.each(['ADMIN', 'MEMBER'] as const)('links the %s logo to its dashboard', async role => {
  api(role); start(role === 'ADMIN' ? '/admin/members' : '/benefits');
  const logo = await screen.findByRole('link', { name: 'HealthBridge dashboard' });
  expect(logo).toHaveAttribute('href', role === 'ADMIN' ? '/admin' : '/dashboard');
  await userEvent.setup().click(logo);
  expect(await screen.findByRole('heading', { level: 1, name: role === 'ADMIN' ? 'Admin Dashboard' : 'Welcome back, John!' })).toBeVisible();
});

it('resets member pagination when sorting and provides a collapsible navigation menu', async () => {
  const fetch = api(); start('/admin/members?page=1');
  const user = userEvent.setup();
  await screen.findByRole('link', { name: 'View and edit Synthetic Member' });
  await user.selectOptions(screen.getByLabelText('Sort members'), 'name-asc');
  await waitFor(() => expect(fetch.mock.calls.some(([path]) => {
    const params = new URL(path, 'http://localhost').searchParams;
    return params.get('sort') === 'name-asc' && params.get('page') === '0';
  })).toBe(true));
  const menu = screen.getByRole('button', { name: /Menu/ });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  await user.click(menu);
  expect(screen.getByRole('button', { name: /Close menu/ })).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByRole('link', { name: 'Admin Dashboard' }));
  expect(screen.getByRole('button', { name: /Menu/ })).toHaveAttribute('aria-expanded', 'false');
});
