import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import ProvidersPage from './ProvidersPage';

it('opens visible doctor details in a dialog and returns focus when closed', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify([{ id: 'P1', name: 'Dr. Synthetic', specialty: 'Primary Care', facility: 'Demo Clinic', city: 'Austin', state: 'TX', networkStatus: 'In Network', acceptingPatients: true, phone: '555-0101', address: '123 Demo Street' }]))));
  render(<StrictMode><ProvidersPage /></StrictMode>);
  const user = userEvent.setup();
  const trigger = await screen.findByRole('button', { name: 'View Details' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Dr. Synthetic' });
  expect(within(dialog).getByText(/123 Demo Street/)).toBeVisible();
  expect(within(dialog).getByRole('link', { name: '555-0101' })).toHaveAttribute('href', 'tel:555-0101');
  await user.click(within(dialog).getByRole('button', { name: 'Close details' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
