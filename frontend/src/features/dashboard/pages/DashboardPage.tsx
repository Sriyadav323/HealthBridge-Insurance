
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiData } from '../../../services/api';
import DashboardCard from '../components/DashboardCard';
import MemberHighlights from '../components/MemberHighlights';
import '../Dashboard.css';

type Benefits = {
  benefitsConfigured?: boolean;
  memberName: string;
  planName: string;
  coverageStatus: string;
  deductible: {
    total: number;
    met: number;
  };
  outOfPocket: {
    maximum: number;
    spent: number;
  };
};

type Claim = {
  id: string;
  status: string;
};

function DashboardPage() {
  const [benefits, setBenefits] = useState<Benefits | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');

        const [benefitsData, claimsData] = await Promise.all([
          getApiData<Benefits>('/members/me/benefits', controller.signal),
          getApiData<Claim[]>('/members/me/claims', controller.signal),
        ]);
        if (controller.signal.aborted) return;

        setBenefits(benefitsData);
        setClaims(claimsData);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard information'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, []);

  const dashboardItems = [
    {
      title: 'My Benefits',
      description: 'View coverage and plan details',
      path: '/benefits',
    },
    {
      title: 'My Claims',
      description: 'Track your insurance claims',
      path: '/claims',
    },
    {
      title: 'Find a Doctor',
      description: 'Search in-network providers',
      path: '/providers',
    },
    {
      title: 'Digital ID Card',
      description: 'Access your insurance ID card',
      path: '/id-card',
    },
  ];

  const approvedClaims = claims.filter(
    (claim) => claim.status.toLowerCase() === 'approved'
  ).length;

  const pendingClaims = claims.filter(
    (claim) => claim.status.toLowerCase() === 'pending'
  ).length;

  const firstName = benefits?.memberName.split(' ')[0];

  return (
    <div className="dashboard">
      <section aria-busy={loading}>
        <p className="dashboard-eyebrow">YOUR PERSONAL HEALTH SPACE</p>
        <h1>
          {loading
            ? 'Loading your dashboard...'
            : benefits
              ? `Welcome back, ${firstName}!`
              : 'Welcome to HealthBridge!'}
        </h1>

        {loading && <p role="status">Loading your plan and claims...</p>}
        <p className="dashboard-intro">A little more clarity for a healthier everyday.</p>
        <MemberHighlights />

        {error && (
          <p role="alert" style={{ color: 'crimson' }}>
            {error}
          </p>
        )}

        {benefits && (
          <section style={{ marginBottom: '24px' }}>
            <h3>My Plan Overview</h3>

            <div className="cards plan-overview-cards">
              <DashboardCard
                title="Current Plan"
                description={benefits.planName}
              />

              <DashboardCard
                title="Coverage Status"
                description={benefits.coverageStatus}
              />

              {benefits.benefitsConfigured !== false && <>
              <DashboardCard
                title="Deductible"
                description={`$${benefits.deductible.met} met of $${benefits.deductible.total}`}
              />

              <DashboardCard
                title="Out-of-Pocket"
                description={`$${benefits.outOfPocket.spent} spent of $${benefits.outOfPocket.maximum}`}
              />

              </>}
              <DashboardCard
                title="Total Claims"
                description={`${claims.length} claims`}
              />

              <DashboardCard
                title="Approved / Pending"
                description={`${approvedClaims} approved, ${pendingClaims} pending`}
              />
            </div>
            {benefits.benefitsConfigured === false && <p>Benefit amounts have not been configured for your new plan yet.</p>}
          </section>
        )}

        <h3>What can we help you with?</h3>

        <div className="cards quick-access-cards">
          {dashboardItems.map((item) => (
            <Link
              key={item.title}
              to={item.path}
              style={{
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <DashboardCard
                title={item.title}
                description={item.description}
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
