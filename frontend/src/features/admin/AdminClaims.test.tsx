import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import AdminClaimsPage from './pages/AdminClaimsPage';
const json = (value: unknown) => new Response(JSON.stringify(value));
const claim = { id: 'CLM-TEST', memberId: 'MEMBER', memberName: 'Synthetic Member', provider: 'Demo Clinic', service: 'Preventive care', serviceDate: '2026-11-01', submittedDate: '2026-11-01', status: 'Pending', billedAmount: 400, allowedAmount: null, insurancePaid: 0, memberResponsibility: 0, deductibleApplied: 0, oopApplied: 0, notes: 'Demo claim', reviewNotes: null, version: 0, coverageSnapshot: JSON.stringify({ planName: 'Gold PPO', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', service: { status: 'Covered', cost: '$25 copay', notes: 'In network' } }) };

it('reviews a pending claim with explicit payment and spending allocations', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/csrf')) return json({ token: 'csrf' });
    if (init?.method === 'PATCH') return json({ ...claim, status: 'Approved', version: 1, allowedAmount: 300, insurancePaid: 200, memberResponsibility: 100, deductibleApplied: 50, oopApplied: 100 });
    if (url.endsWith('/CLM-TEST')) return json(claim);
    return json({ items: [claim], total: 1, page: 0, size: 25 });
  });
  vi.stubGlobal('fetch', fetch);
  render(<AdminClaimsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Review claim' }));
  expect(await screen.findByText('Gold PPO')).toBeVisible();
  await user.type(screen.getByLabelText('Allowed amount ($)'), '300');
  await user.type(screen.getByLabelText('Insurance paid ($)'), '200');
  await user.type(screen.getByLabelText('Member responsibility ($)'), '100');
  await user.clear(screen.getByLabelText('Apply to deductible ($)'));
  await user.type(screen.getByLabelText('Apply to deductible ($)'), '50');
  await user.clear(screen.getByLabelText('Apply to out-of-pocket spending ($)'));
  await user.type(screen.getByLabelText('Apply to out-of-pocket spending ($)'), '100');
  await user.type(screen.getByLabelText('Review notes / reason'), 'Reviewed assigned coverage');
  await user.click(screen.getByRole('button', { name: 'Finalize claim' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Claim finalized');
  expect(screen.queryByRole('button', { name: 'Finalize claim' })).not.toBeInTheDocument();
  const request = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(JSON.parse(request?.[1]?.body as string)).toMatchObject({ version: 0, status: 'Approved', allowedAmount: 300, insurancePaid: 200, memberResponsibility: 100, deductibleApplied: 50, oopApplied: 100 });
});

it('creates a pending claim from the selected member’s assigned coverage', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/csrf')) return json({ token: 'csrf' });
    if (init?.method === 'POST') return json(claim);
    if (url.includes('/admin/members?')) return json({ items: [{ memberId: 'MEMBER', fullName: 'Synthetic Member' }], totalElements: 1 });
    if (url.includes('/member-coverage?')) return json({ memberName: 'Synthetic Member', planName: 'Gold PPO', coverageStatus: 'Active', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', deductibleTotal: 1500, deductibleMet: 0, oopMaximum: 5000, oopSpent: 0, items: [{ id: 'SERVICE', name: 'Preventive care', status: 'Covered', cost: '$25 copay' }] });
    return json({ items: [], total: 0, page: 0, size: 25 });
  });
  vi.stubGlobal('fetch', fetch);
  render(<AdminClaimsPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Create claim' }));
  await screen.findByRole('option', { name: /Synthetic Member/ });
  await user.selectOptions(screen.getByLabelText('Member'), 'MEMBER');
  await screen.findByRole('option', { name: /Preventive care/ });
  await user.selectOptions(screen.getByLabelText('Covered service / exclusion'), 'SERVICE');
  await user.type(screen.getByLabelText('Provider / facility'), 'Demo Clinic');
  await user.type(screen.getByLabelText('Service date'), '2026-01-01');
  await user.type(screen.getByLabelText('Billed amount ($)'), '400');
  await user.click(screen.getByRole('button', { name: 'Create pending claim' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Pending claim created');
  const request = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(request?.[1]?.body as string)).toMatchObject({ memberId: 'MEMBER', coverageItemId: 'SERVICE', billedAmount: 400 });
});

it('searches members by the entered query and updates the member dropdown', async () => {
  const fetch = vi.fn(async (url: string) => {
    if (url.includes('/admin/members?')) {
      const query = new URL(url, 'http://localhost').searchParams.get('search');
      return json({ items: query === 'Alex' ? [{ memberId: 'ALEX', fullName: 'Alex Sample' }] : [{ memberId: 'OTHER', fullName: 'Other Member' }], totalElements: 1 });
    }
    return json({ items: [], total: 0, page: 0, size: 25 });
  });
  vi.stubGlobal('fetch', fetch);
  render(<AdminClaimsPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Create claim' }));
  await screen.findByRole('option', { name: /Other Member/ });
  await user.type(screen.getByLabelText('Find a member'), 'Alex');
  await user.click(screen.getByRole('button', { name: 'Search members' }));
  expect(await screen.findByRole('option', { name: /Alex Sample/ })).toBeVisible();
  expect(screen.queryByRole('option', { name: /Other Member/ })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => new URL(url, 'http://localhost').searchParams.get('search') === 'Alex')).toBe(true);
});

it('makes payment fields editable for approvals and explains zero allocations for denials', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/CLM-TEST') ? json(claim) : json({ items: [claim], total: 1, page: 0, size: 25 })));
  render(<AdminClaimsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Review claim' }));
  const paid = await screen.findByLabelText('Insurance paid ($)');
  const deductible = screen.getByLabelText('Apply to deductible ($)');
  const oop = screen.getByLabelText('Apply to out-of-pocket spending ($)');
  expect(paid).toBeEnabled();
  await user.type(paid, '200');
  await user.clear(deductible); await user.type(deductible, '50');
  await user.clear(oop); await user.type(oop, '100');
  expect(paid).toHaveValue(200); expect(deductible).toHaveValue(50); expect(oop).toHaveValue(100);
  await user.selectOptions(screen.getByLabelText('Decision'), 'Denied');
  for (const input of [paid, deductible, oop]) { expect(input).toBeDisabled(); expect(input).toHaveValue(0); }
  expect(paid).toHaveAccessibleDescription(/zero for denied claims/);
  await user.selectOptions(screen.getByLabelText('Decision'), 'Approved');
  for (const input of [paid, deductible, oop]) expect(input).toBeEnabled();
  expect(paid).toHaveValue(200);
});

it('enables historical approval after explicit coverage confirmation without losing entered amounts', async () => {
  const legacy = { ...claim, coverageSnapshot: null };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/csrf')) return json({ token: 'csrf' });
    if (url.endsWith('/coverage') && init?.method === 'POST') return json({ ...claim, version: 1 });
    if (url.endsWith('/CLM-TEST')) return json(legacy);
    if (url.includes('/member-coverage?')) return json({ memberName: 'Synthetic Member', planName: 'Gold PPO', coverageStatus: 'Active', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', items: [{ id: 'SERVICE', name: 'Preventive care', status: 'Covered', cost: '$25 copay' }] });
    return json({ items: [legacy], total: 1, page: 0, size: 25 });
  });
  vi.stubGlobal('fetch', fetch);
  render(<AdminClaimsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Review claim' }));
  const paid = await screen.findByLabelText('Insurance paid ($)');
  expect(paid).toBeEnabled();
  await user.type(paid, '200');
  expect(screen.getByRole('button', { name: 'Finalize claim' })).toBeDisabled();
  await screen.findByRole('option', { name: /Preventive care/ });
  await user.selectOptions(screen.getByLabelText('Applicable service'), 'SERVICE');
  await user.click(screen.getByRole('checkbox', { name: /I confirm this plan/ }));
  await user.click(screen.getByRole('button', { name: 'Confirm claim coverage' }));
  expect(await screen.findByText(/Coverage confirmed. Review the payment fields/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Finalize claim' })).toBeEnabled();
  expect(screen.getByLabelText('Insurance paid ($)')).toHaveValue(200);
  const call = fetch.mock.calls.find(([url,init]) => url.endsWith('/coverage') && init?.method === 'POST');
  expect(JSON.parse(call?.[1]?.body as string)).toEqual({ version: 0, coverageItemId: 'SERVICE', confirmed: true });
});
