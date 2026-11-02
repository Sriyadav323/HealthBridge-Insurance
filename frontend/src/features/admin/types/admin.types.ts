export type MemberSummary = {
  memberId: string; fullName: string; email: string | null; phone: string | null;
  planName: string; planType: 'HMO' | 'PPO' | 'EPO'; coverageStatus: 'Active' | 'Inactive';
  accountEnabled: boolean | null; passwordSetupRequired: boolean; registeredAt: string | null; version: number;
};
export type MemberDetails = { summary: MemberSummary; address: string | null };
export type MemberWrite = {
  fullName: string; email: string; phone: string; address: string;
  planName: string; planType: string; coverageStatus: string; version?: number; planId?: number;
};
export type MemberPage = { items: MemberSummary[]; totalElements: number; totalPages: number; page: number; size: number };
export type AdminDashboard = { totalMembers: number; activeMembers: number; inactiveMembers: number; enabledAccounts: number; recentRegistrations: MemberSummary[] };
export type Registration = { details: MemberDetails; setupToken: string; setupExpiresAt: string };

export function accountStatus(member: MemberSummary): string {
  if (member.accountEnabled === null) return 'No account';
  if (member.passwordSetupRequired) return 'Password setup required';
  return member.accountEnabled ? 'Enabled' : 'Disabled';
}

export type PlanCoverage = { name: string; category: 'Medical' | 'Pharmacy'; status: 'Covered' | 'Not Covered'; cost: string; notes: string };
export type InsurancePlan = { id: number; planName: string; planType: 'PPO' | 'HMO' | 'EPO'; effectiveFrom: string; effectiveTo: string; retired: boolean; deductibleTotal: number; oopMaximum: number; primaryCare: number; specialist: number; urgentCare: number; coverage: PlanCoverage[] };
