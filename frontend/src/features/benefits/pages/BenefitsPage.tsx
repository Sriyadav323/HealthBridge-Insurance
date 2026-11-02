import { formatDate } from '../../../utils/date';
import { useApiData } from '../../../hooks/useApiData';
import type { InsuranceBenefits } from '../types/benefits.types';
import BenefitProgressCard from '../components/BenefitProgressCard';
import CoverageTable from '../components/CoverageTable';
import '../Benefits.css';

function BenefitsPage() {
  const { data: benefits, loading, error } =
    useApiData<InsuranceBenefits>('/members/me/benefits');

  if (loading) return <p role="status">Loading benefits...</p>;
  if (error) return <p role="alert">Unable to load benefits: {error}</p>;
  if (!benefits) return <p>No benefits found.</p>;

  return (
    <div className="benefits-page">
      <h1>My Benefits</h1>

      <section className="benefit-plan-card">
        <div className="benefit-plan-header">
          <h2>{benefits.planName}</h2>
          <span className={`coverage-status ${benefits.coverageStatus.toLowerCase()}`}>
            {benefits.coverageStatus}
          </span>
        </div>

        <p>Member: {benefits.memberName}</p>
        <p>Member ID: {benefits.memberId}</p>
        <p>Plan Type: {benefits.planType}</p>
        {benefits.effectiveFrom && <p>Coverage period: {formatDate(benefits.effectiveFrom)} through {formatDate(benefits.effectiveTo)}</p>}
      </section>

      {benefits.benefitsConfigured === false ? <p role="status">Your plan is registered. Benefit amounts and coverage details have not been configured yet.</p> : <>
      <div className="benefit-progress-grid">
        <BenefitProgressCard
          title="Annual Deductible"
          total={benefits.deductible.total}
          used={benefits.deductible.met}
          usedLabel="met"
        />

        <BenefitProgressCard
          title="Out-of-Pocket Maximum"
          total={benefits.outOfPocket.maximum}
          used={benefits.outOfPocket.spent}
          usedLabel="spent"
        />
      </div>

      <section className="benefit-copay-card">
        <h2>Copays</h2>

        <div className="copay-row">
          <span>Primary Care</span>
          <strong>${benefits.copays.primaryCare}</strong>
        </div>

        <div className="copay-row">
          <span>Specialist</span>
          <strong>${benefits.copays.specialist}</strong>
        </div>

        <div className="copay-row">
          <span>Urgent Care</span>
          <strong>${benefits.copays.urgentCare}</strong>
        </div>
      </section>

      <CoverageTable items={benefits.coverage} />
      </>}

      <p className="benefits-disclaimer">
        Demo insurance data only. Actual coverage and costs
        depend on plan documents and claim processing.
      </p>
    </div>
  );
}

export default BenefitsPage;
