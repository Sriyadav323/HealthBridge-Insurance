import { formatDate } from '../../../utils/date';
import { useState } from 'react';
import { useApiData } from '../../../hooks/useApiData';
import type {
  InsuranceClaim,
  ClaimStatus,
} from '../types/claims.types';
import '../Claims.css';

type StatusFilter = 'All' | ClaimStatus;

const money = (amount: number) =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

function ClaimsPage() {
  const {
    data: claimsData,
    loading,
    error,
  } = useApiData<InsuranceClaim[]>('/members/me/claims');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [selectedClaim, setSelectedClaim] =
    useState<InsuranceClaim | null>(null);

  if (loading) return <p role="status">Loading claims...</p>;
  if (error) return <p role="alert">Unable to load claims: {error}</p>;
  if (!claimsData) return <p>No claims available.</p>;

  const filteredClaims = claimsData.filter((claim) => {
    const matchesSearch =
      `${claim.id} ${claim.provider} ${claim.service}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      status === 'All' || claim.status === status;

    return matchesSearch && matchesStatus;
  });

  const approved = claimsData.filter(
    (claim) => claim.status === 'Approved'
  ).length;

  const pending = claimsData.filter(
    (claim) => claim.status === 'Pending'
  ).length;

  return (
    <div className="claims-page">
      <h1>My Claims</h1>
      <p>View and track your health insurance claims.</p>

      <div className="claims-summary">
        <div className="claims-card">
          <span>Total Claims</span>
          <strong>{claimsData.length}</strong>
        </div>
        <div className="claims-card">
          <span>Approved</span>
          <strong>{approved}</strong>
        </div>
        <div className="claims-card">
          <span>Pending</span>
          <strong>{pending}</strong>
        </div>
      </div>

      <section className="claims-panel">
        <div className="claims-filters">
          <input
            aria-label="Search claims"
            placeholder="Search by claim ID, provider or service..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filter claim status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StatusFilter)
            }
          >
            <option value="All">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Denied">Denied</option>
          </select>
        </div>

        <div className="claims-table-wrapper">
          <table className="claims-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Provider</th>
                <th>Service Date</th>
                <th>Status</th>
                <th className="table-money">Member Cost</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => (
                <tr key={claim.id}>
                  <td>{claim.id}</td>
                  <td>{claim.provider}</td>
                  <td>{formatDate(claim.serviceDate)}</td>
                  <td>
                    <span
                      className={`claim-status ${claim.status.toLowerCase()}`}
                    >
                      {claim.status}
                    </span>
                  </td>
                  <td className="table-money">
                    {claim.memberResponsibility === null
                      ? 'Not finalized'
                      : money(claim.memberResponsibility)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="claim-details-button"
                      onClick={() => setSelectedClaim(claim)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredClaims.length === 0 && (
            <p>No claims match your search.</p>
          )}
        </div>
      </section>

      {selectedClaim && (
        <section className="claims-panel claim-detail-panel">
          <div className="claim-detail-header">
            <h2>Claim Details: {selectedClaim.id}</h2>
            <button
              type="button"
              onClick={() => setSelectedClaim(null)}
            >
              Close
            </button>
          </div>

          <p><strong>Provider:</strong> {selectedClaim.provider}</p>
          <p><strong>Service:</strong> {selectedClaim.service}</p>
          <p><strong>Service Date:</strong> {formatDate(selectedClaim.serviceDate)}</p>
          <p><strong>Submitted:</strong> {formatDate(selectedClaim.submittedDate)}</p>
          <p><strong>Status:</strong> {selectedClaim.status}</p>
          <p><strong>Billed:</strong> {money(selectedClaim.billedAmount)}</p>
          <p>
            <strong>Insurance Paid:</strong>{' '}
            {selectedClaim.insurancePaid === null
              ? 'Not finalized'
              : money(selectedClaim.insurancePaid)}
          </p>
          <p>
            <strong>Member Responsibility:</strong>{' '}
            {selectedClaim.memberResponsibility === null
              ? 'Not finalized'
              : money(selectedClaim.memberResponsibility)}
          </p>
          <p><strong>Notes:</strong> {selectedClaim.notes}</p>
          {selectedClaim.allowedAmount != null && <p><strong>Allowed amount:</strong> {money(selectedClaim.allowedAmount)}</p>}
          {selectedClaim.reviewNotes && <p><strong>Review:</strong> {selectedClaim.reviewNotes}</p>}
          {selectedClaim.status !== 'Pending' && selectedClaim.deductibleApplied != null && <p><strong>Applied to deductible:</strong> {money(selectedClaim.deductibleApplied)} · <strong>Applied to out of pocket:</strong> {money(selectedClaim.oopApplied ?? 0)}</p>}
        </section>
      )}

      <p className="claims-disclaimer">
        Fictional claim data for demonstration only.
        Billed amounts are not necessarily allowed amounts,
        and member responsibility is subject to final adjudication.
      </p>
    </div>
  );
}

export default ClaimsPage;
