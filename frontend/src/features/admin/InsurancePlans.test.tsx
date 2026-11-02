import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import InsurancePlansPage from './pages/InsurancePlansPage';
import MemberForm from './components/MemberForm';

const plan = { id: 7, planName: 'Gold PPO', planType: 'PPO', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', retired: false, deductibleTotal: 1500, oopMaximum: 5000, primaryCare: 25, specialist: 50, urgentCare: 75, coverage: [{ name: 'Preventive care', category: 'Medical', status: 'Covered', cost: '$0', notes: 'In network' }] };
const json = (body: unknown) => new Response(JSON.stringify(body));

it('publishes coverage and benefit amounts as a new plan version', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/csrf')) return json({ token: 'csrf' });
    if (init?.method === 'POST') return json(plan);
    return json([]);
  });
  vi.stubGlobal('fetch', fetch);
  render(<InsurancePlansPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Create plan' }));
  for (const [label, value] of [['Plan name','Gold PPO'],['Effective from','2026-01-01'],['Effective through','2026-12-31'],['Annual deductible ($)','1500'],['Out-of-pocket maximum ($)','5000'],['Primary care copay ($)','25'],['Specialist copay ($)','50'],['Urgent care copay ($)','75'],['Service name','Preventive care'],['Member cost','$0']] as const) {
    await user.type(screen.getByLabelText(label), value);
  }
  await user.click(screen.getByRole('button', { name: 'Publish plan version' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Plan version published');
  const call = fetch.mock.calls.find(([,init]) => init?.method === 'POST');
  expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({ planName: 'Gold PPO', deductibleTotal: 1500, primaryCare: 25, coverage: [{ name: 'Preventive care', category: 'Medical' }] });
});

it('retiring a plan requires confirmation and uses its version id', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/csrf')) return json({ token: 'csrf' });
    if (init?.method === 'POST') return new Response(null, { status: 204 });
    return json([plan]);
  });
  vi.stubGlobal('fetch', fetch);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<InsurancePlansPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Retire from enrollment' }));
  expect(fetch.mock.calls.some(([,init]) => init?.method === 'POST')).toBe(false);
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Retire from enrollment' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Existing member coverage is unchanged');
  expect(fetch).toHaveBeenCalledWith('/api/v1/admin/insurance-plans/7/retire', expect.objectContaining({ method: 'POST' }));
});

it('sends the exact catalog version during enrollment', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([plan])));
  const save = vi.fn().mockResolvedValue(undefined);
  render(<MemberForm saving={false} onSave={save} submitLabel="Save enrollment" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Full name'), 'Synthetic Member');
  await user.type(screen.getByLabelText('Email address'), 'test@example.com');
  await screen.findByRole('option', { name: /Gold PPO/ });
  await user.selectOptions(screen.getByLabelText('Insurance plan'), '7');
  await user.click(screen.getByRole('button', { name: 'Save enrollment' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ planId: 7, planName: 'Gold PPO', planType: 'PPO' }));
});

it('explains an empty enrollment catalog and links to plan configuration', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
  render(<MemberForm saving={false} onSave={vi.fn()} submitLabel="Register member" />);
  expect(await screen.findByRole('status')).toHaveTextContent('No insurance plans are available yet');
  expect(screen.getByLabelText('Insurance plan')).toBeEnabled();
  expect(screen.getByRole('option', { name: 'No published plans available' })).toBeDisabled();
  expect(screen.getByRole('link', { name: /Create an insurance plan/ })).toHaveAttribute('href', '/admin/plans');
  expect(screen.getByRole('button', { name: 'Register member' })).toBeDisabled();
});

it('explains when a scheduled plan becomes available for enrollment', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ ...plan, effectiveFrom: '2099-11-10', effectiveTo: '2099-12-10' }])));
  render(<InsurancePlansPage />);
  expect(await screen.findByText('Scheduled')).toBeVisible();
  expect(screen.getByText('Available for enrollment from Nov 10, 2099.')).toBeVisible();
});
