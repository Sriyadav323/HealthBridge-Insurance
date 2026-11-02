import { expect, it } from 'vitest';
import { planStatus } from './planStatus';
const plan = { retired: false, effectiveFrom: '2026-11-10', effectiveTo: '2026-12-10' };
it('distinguishes scheduled, current, expired, and retired versions at date boundaries', () => {
  expect(planStatus(plan, '2026-11-01')).toBe('Scheduled');
  expect(planStatus(plan, '2026-11-10')).toBe('Available');
  expect(planStatus(plan, '2026-12-10')).toBe('Available');
  expect(planStatus(plan, '2026-12-11')).toBe('Expired');
  expect(planStatus({ ...plan, retired: true }, '2026-11-01')).toBe('Retired');
});
