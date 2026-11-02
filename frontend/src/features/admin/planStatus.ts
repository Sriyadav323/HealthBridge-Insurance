import type { InsurancePlan } from './types/admin.types';
export type PlanStatus = 'Available' | 'Scheduled' | 'Expired' | 'Retired';
export function planStatus(plan: Pick<InsurancePlan, 'retired' | 'effectiveFrom' | 'effectiveTo'>, today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' }).format(new Date())): PlanStatus {
  if (plan.retired) return 'Retired';
  if (today < plan.effectiveFrom) return 'Scheduled';
  if (today > plan.effectiveTo) return 'Expired';
  return 'Available';
}
