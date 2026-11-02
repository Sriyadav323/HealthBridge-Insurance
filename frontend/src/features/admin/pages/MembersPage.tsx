import TableSkeleton from '../../../components/TableSkeleton';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApiData } from '../../../hooks/useApiData';
import { accountStatus } from '../types/admin.types';
import type { MemberPage } from '../types/admin.types';
import '../Admin.css';

export default function MembersPage() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApiData<MemberPage>(`/admin/members?${params.toString()}`);
  const page = Math.max(0, Number(params.get('page')) || 0);
  function change(name: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set(name, value); if (name !== 'page') next.set('page', '0'); return next; });
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); change('search', String(new FormData(event.currentTarget).get('search') ?? '').trim()); }
  return <div className="admin-page"><div className="admin-heading"><div><p className="admin-eyebrow">Member directory</p><h1>Member Management</h1></div><Link className="admin-primary" to="/admin/members/new">Register Member</Link></div>
    <form className="admin-filters" onSubmit={submit}>
      <label>Search members<input type="search" maxLength={150} placeholder="Name, member ID, or email" key={params.get('search') ?? ''} name="search" defaultValue={params.get('search') ?? ''} /></label><button>Search</button>
      <label>Coverage status<select value={params.get('coverage') ?? ''} onChange={e => change('coverage', e.target.value)}><option value="">All coverage</option><option>Active</option><option>Inactive</option></select></label>
      <label>Login account status<select value={params.get('account') ?? ''} onChange={e => change('account', e.target.value)}><option value="">All accounts</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option><option value="pending">Password setup required</option><option value="missing">No account</option></select></label>
      <label>Members per page<select value={params.get('size') ?? '10'} onChange={e => change('size', e.target.value)}><option>10</option><option>25</option><option>50</option></select></label>
      <label>Sort members<select value={params.get('sort') ?? 'newest'} onChange={e => change('sort', e.target.value)}><option value="newest">Newest registrations</option><option value="oldest">Oldest registrations</option><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option><option value="plan-asc">Insurance plan: A–Z</option></select></label>
      {(params.get('search') || params.get('coverage') || params.get('account')) && <button type="button" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>}
    </form>
    {loading && <><p role="status">Loading members...</p><TableSkeleton /></>}{error && <div role="alert"><p>{error}</p><button onClick={reload}>Try again</button></div>}
    {data && <section className="admin-panel"><p role="status">{data.totalElements.toLocaleString()} members found{data.items.length > 0 ? ` · Showing ${data.page * data.size + 1}–${data.page * data.size + data.items.length}` : ''}</p>
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Member results"><table className="admin-table"><caption className="sr-only">Registered members and login access</caption><thead><tr>{['Member ID', 'Full name', 'Email', 'Phone', 'Insurance plan', 'Coverage status', 'Login account', 'Actions'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>
        {data.items.map(member => <tr key={member.memberId}><td>{member.memberId}</td><th scope="row">{member.fullName}</th><td>{member.email ?? 'Not available'}</td><td>{member.phone || 'Not provided'}</td><td>{member.planName} ({member.planType})</td><td><span className={`admin-badge ${member.coverageStatus.toLowerCase()}`}>{member.coverageStatus}</span></td><td>{accountStatus(member)}</td><td><Link to={`/admin/members/${member.memberId}`} aria-label={`View and edit ${member.fullName}`}>View / Edit</Link></td></tr>)}
      </tbody></table></div>
      {!data.items.length && <div className="table-empty"><h2>No matching members</h2><p>Try another name, member ID, or filter.</p><button onClick={() => setParams(new URLSearchParams())}>Clear filters</button></div>}
      <nav className="admin-pagination" aria-label="Member pagination"><button disabled={loading || page <= 0} onClick={() => change('page', String(page - 1))}>Previous</button><span>Page {data.totalPages ? data.page + 1 : 0} of {data.totalPages}</span><button disabled={loading || page + 1 >= data.totalPages} onClick={() => change('page', String(page + 1))}>Next</button></nav>
    </section>}
  </div>;
}
