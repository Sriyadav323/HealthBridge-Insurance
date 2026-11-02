export type ClaimStatus =
  | 'Approved'
  | 'Pending'
  | 'Denied';

export interface InsuranceClaim {
  id: string;
  provider: string;
  service: string;
  serviceDate: string;
  submittedDate: string;
  status: ClaimStatus;
  billedAmount: number;
  insurancePaid: number | null;
  memberResponsibility: number | null;
  notes: string;
  allowedAmount?: number | null;
  reviewNotes?: string | null;
  deductibleApplied?: number;
  oopApplied?: number;
}
