import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import InsuranceIdCard from './InsuranceIdCard';
import { benefitsData } from '../../benefits/data/benefitsData';

it('shows the authenticated card, flips both sides, and invokes printing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(benefitsData))));
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<InsuranceIdCard />);
  const user = userEvent.setup();
  expect(await screen.findByRole('heading', { name: benefitsData.memberName })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Front' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('heading', { name: 'Important Member Information' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: benefitsData.memberName })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Front' }));
  expect(screen.getByRole('heading', { name: benefitsData.memberName })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Print / Save PDF' }));
  expect(print).toHaveBeenCalledOnce();
});
