export interface CoverageItem {
  id: string;
  name: string;
  category: 'Medical' | 'Pharmacy';
  status: 'Covered' | 'Not Covered';
  cost: string;
  notes: string;
}

export interface InsuranceBenefits {
  coverage: CoverageItem[];
  benefitsConfigured?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  memberName: string;
  memberId: string;
  planName: string;
  planType: 'HMO' | 'PPO' | 'EPO';
  coverageStatus: 'Active' | 'Inactive';

  deductible: {
    total: number;
    met: number;
  };

  outOfPocket: {
    maximum: number;
    spent: number;
  };

  copays: {
    primaryCare: number;
    specialist: number;
    urgentCare: number;
  };
}

