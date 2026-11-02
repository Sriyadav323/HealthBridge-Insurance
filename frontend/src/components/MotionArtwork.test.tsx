import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import MotionArtwork from './MotionArtwork';

it('allows decorative effects to be paused and resumed', async () => {
  render(<MotionArtwork />);
  const user = userEvent.setup();
  const pause = screen.getByRole('button', { name: /Pause effects/ });
  await user.click(pause);
  expect(screen.getByRole('button', { name: /Play effects/ })).toHaveAttribute('aria-pressed', 'true');
  expect(pause.parentElement).toHaveClass('brand-motion-paused');
  await user.click(screen.getByRole('button', { name: /Play effects/ }));
  expect(screen.getByRole('button', { name: /Pause effects/ })).toHaveAttribute('aria-pressed', 'false');
  expect(pause.parentElement).not.toHaveClass('brand-motion-paused');
});
