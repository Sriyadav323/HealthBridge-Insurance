import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import ProfilePage from './ProfilePage';

it('loads the authenticated profile and saves contact changes with CSRF', async () => {
  const profile = { memberId: 'SYNTHETIC-A', fullName: 'Synthetic Member', email: 'member@example.com', phone: null, address: null, planName: 'Demo PPO', planType: 'PPO', coverageStatus: 'Active' };
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(profile)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'profile-token' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...profile, phone: '555-0101' })));
  vi.stubGlobal('fetch', fetch);
  render(<ProfilePage />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading profile');
  expect(await screen.findByText('Synthetic Member')).toBeVisible();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Phone number'), '555-0101');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Contact information saved.');
  expect(fetch).toHaveBeenLastCalledWith('/api/v1/members/me/profile', expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ phone: '555-0101', address: '' }),
    headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'profile-token' }),
  }));
});
