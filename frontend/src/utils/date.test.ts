import { expect, it } from 'vitest';
import { formatDate } from './date';
it('preserves calendar dates while formatting them for display', () => {
  expect(formatDate('2026-11-01')).toBe('Nov 01, 2026');
  expect(formatDate('2026-01-01')).toBe('Jan 01, 2026');
});
it('uses Central time for timestamps and handles unavailable values', () => {
  expect(formatDate('2026-11-01T00:00:00Z')).toBe('Oct 31, 2026');
  expect(formatDate(null)).toBe('Not available');
  expect(formatDate('invalid')).toBe('Not available');
});
