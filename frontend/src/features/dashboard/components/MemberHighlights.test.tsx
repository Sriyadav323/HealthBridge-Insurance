import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import MemberHighlights from './MemberHighlights';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function motion(reduce = false) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
function show() { render(<MemoryRouter><MemberHighlights /></MemoryRouter>); }
it('rotates every eight seconds and pauses when requested', () => {
  motion(); vi.useFakeTimers(); show();
  expect(screen.getByRole('link', { name: /Explore your benefits/ })).toHaveAttribute('href', '/benefits');
  act(() => { vi.advanceTimersByTime(8000); });
  expect(screen.getByRole('link', { name: /Find a doctor/ })).toHaveAttribute('href', '/providers');
  fireEvent.click(screen.getByRole('button', { name: 'Pause banner rotation' }));
  expect(screen.getByRole('region', { name: 'Featured member resources' })).toHaveClass('motion-paused');
  act(() => { vi.advanceTimersByTime(16000); });
  expect(screen.getByRole('link', { name: /Find a doctor/ })).toBeVisible();
});
it('allows manual navigation without automatic rotation for reduced motion', () => {
  motion(true); vi.useFakeTimers(); show();
  act(() => { vi.advanceTimersByTime(24000); });
  expect(screen.getByRole('link', { name: /Explore your benefits/ })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Pause banner rotation' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous banner' }));
  expect(screen.getByRole('link', { name: /View digital ID/ })).toHaveAttribute('href', '/id-card');
});
it('pauses while a member reads or focuses the banner', () => {
  motion(); vi.useFakeTimers(); show();
  const region = screen.getByRole('region', { name: 'Featured member resources' });
  fireEvent.mouseEnter(region);
  act(() => { vi.advanceTimersByTime(16000); });
  expect(screen.getByRole('link', { name: /Explore your benefits/ })).toBeVisible();
  fireEvent.mouseLeave(region);
  fireEvent.focus(screen.getByRole('link', { name: /Explore your benefits/ }));
  act(() => { vi.advanceTimersByTime(16000); });
  expect(screen.getByRole('link', { name: /Explore your benefits/ })).toBeVisible();
});
