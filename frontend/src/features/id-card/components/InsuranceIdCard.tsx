import { useState } from 'react';
import { useApiData } from '../../../hooks/useApiData';
import type { InsuranceBenefits } from '../../benefits/types/benefits.types';

function InsuranceIdCard() {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const { data: benefits, loading, error } = useApiData<InsuranceBenefits>('/members/me/benefits');
  if (loading) return <p role="status">Loading member ID card...</p>;
  if (error) return <p role="alert">Unable to load ID card: {error}</p>;
  if (!benefits) return <p>No member details available.</p>;

  return (
    <div>
      <div className="id-card-actions no-print">
        <button
          type="button"
          className={side === 'front' ? 'selected' : ''}
          aria-pressed={side === 'front'}
          onClick={() => setSide('front')}
        >
          Front
        </button>

        <button
          type="button"
          className={side === 'back' ? 'selected' : ''}
          aria-pressed={side === 'back'}
          onClick={() => setSide('back')}
        >
          Back
        </button>

        <button
          type="button"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </div>

      <div className="insurance-id-card">
        {side === 'front' ? (
          <>
            <div className="id-card-header">
              <div>
                <h2>HealthBridge Insurance</h2>
                <p>Member Identification Card</p>
              </div>
              <span className="id-card-plan-type">
                {benefits.planType}
              </span>
            </div>

            <div className="id-card-member">
              <small>MEMBER NAME</small>
              <h3>{benefits.memberName}</h3>
            </div>

            <div className="id-card-grid">
              <div>
                <small>MEMBER ID</small>
                <strong>{benefits.memberId}</strong>
              </div>
              <div>
                <small>PLAN</small>
                <strong>{benefits.planName}</strong>
              </div>
              <div>
                <small>PRIMARY CARE</small>
                <strong>{benefits.benefitsConfigured === false ? 'Not configured' : `$${benefits.copays.primaryCare} Copay`}</strong>
              </div>
              <div>
                <small>SPECIALIST</small>
                <strong>{benefits.benefitsConfigured === false ? 'Not configured' : `$${benefits.copays.specialist} Copay`}</strong>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2>Important Member Information</h2>

            <p>
              Present this card when receiving covered
              healthcare services.
            </p>

            <div className="id-card-back-details">
              <p>
                <strong>Member Services:</strong>
                {' '}See your plan documents
              </p>

              <p>
                <strong>Provider Network:</strong>
                {' '}{benefits.planName}
              </p>

              <p>
                <strong>Claims:</strong>
                {' '}View claims through the member portal
              </p>

              <p>
                <strong>Coverage:</strong>
                {' '}Subject to plan terms and eligibility
              </p>
            </div>

            <p className="id-card-note">
              Demonstration card only. Not valid insurance.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default InsuranceIdCard;
