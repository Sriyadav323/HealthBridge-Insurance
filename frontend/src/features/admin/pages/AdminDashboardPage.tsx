import MotionArtwork from '../../../components/MotionArtwork';
import { formatDate } from '../../../utils/date';
import { Link } from 'react-router-dom';
import { useApiData } from '../../../hooks/useApiData';
import type { AdminDashboard } from '../types/admin.types';
import '../Admin.css';

export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useApiData<AdminDashboard>('/admin/dashboard');
  return <div className="admin-page"><div className="admin-heading"><div><p className="admin-eyebrow">HealthBridge administration</p><h1>Admin Dashboard</h1></div><Link className="admin-primary" to="/admin/members/new">Register Member</Link></div>
    <p>People, plans, and the details that matter. All in one thoughtful workspace.</p>
    <section className="admin-welcome"><div><p className="premium-eyebrow">BUILT AROUND PEOPLE</p><h2>Great care starts with<br />a warm welcome.</h2><p>Bring a new member into the HealthBridge community.</p><Link to="/admin/members/new">Register a member <span aria-hidden="true">↗</span></Link></div><MotionArtwork /></section>
    {loading && <p role="status">Loading dashboard statistics...</p>}{error && <div role="alert"><p>{error}</p><button onClick={reload}>Try again</button></div>}
    {data && <><div className="admin-stats">
      {[['Total registered members', data.totalMembers], ['Active members', data.activeMembers], ['Inactive members', data.inactiveMembers], ['Enabled login accounts', data.enabledAccounts]].map(([label, value]) =>
        <section className="admin-stat" key={label}><h2>{label}</h2><strong>{Number(value).toLocaleString()}</strong></section>)}
    </div><section className="admin-panel"><div className="admin-heading"><h2>Recent registrations</h2><Link to="/admin/members">View all members</Link></div>
      {data.recentRegistrations.length ? <ul className="admin-recent">{data.recentRegistrations.map(member => <li key={member.memberId}><Link to={`/admin/members/${member.memberId}`}>{member.fullName}</Link><span>{member.memberId}</span><time dateTime={member.registeredAt ?? undefined}>{member.registeredAt ? formatDate(member.registeredAt) : 'Date unavailable'}</time></li>)}</ul> : <p>No new registrations yet. Historical registration dates remain unknown.</p>}
    </section></>}
  </div>;
}
