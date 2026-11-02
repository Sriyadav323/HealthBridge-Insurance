import { useApiData } from '../../../hooks/useApiData';
import '../../shared/FeaturePages.css';
type Prescription = { id: number; medication: string; dosage: string; pharmacy: string; refillStatus: string; refillsRemaining: number; lastFilled: string | null };
export default function PharmacyPage() {
  const { data, loading, error } = useApiData<Prescription[]>('/members/me/prescriptions');
  return <div className="feature-page"><h1>Pharmacy & Prescriptions</h1><p>Review your current prescriptions and refill eligibility.</p>
    {loading && <p role="status">Loading prescriptions...</p>}{error && <p role="alert" className="feature-error">{error}</p>}
    {data?.length === 0 && <p>No prescriptions found.</p>}
    <div className="feature-grid">{data?.map(rx => <article key={rx.id} className="feature-panel">
      <h2>{rx.medication}</h2><dl className="feature-details"><div><dt>Dosage</dt><dd>{rx.dosage}</dd></div>
      <div><dt>Pharmacy</dt><dd>{rx.pharmacy}</dd></div><div><dt>Refill status</dt><dd>{rx.refillStatus}</dd></div>
      <div><dt>Refills remaining</dt><dd>{rx.refillsRemaining}</dd></div><div><dt>Last filled</dt><dd>{rx.lastFilled ?? 'Not available'}</dd></div></dl>
      <p className="feature-muted">Refill requests are not enabled in this demonstration.</p></article>)}</div>
    <p className="feature-muted">Synthetic prescription information for demonstration only.</p></div>;
}
