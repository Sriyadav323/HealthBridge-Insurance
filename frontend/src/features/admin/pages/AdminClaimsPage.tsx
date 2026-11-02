import ValidatedForm from '../../../components/ValidatedForm';
import { formatDate } from '../../../utils/date';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApiData } from '../../../hooks/useApiData';
import { getApiData, mutateApiData } from '../../../services/api';
import type { MemberPage } from '../types/admin.types';
import '../Admin.css';

type Claim = { id: string; memberId: string; memberName: string; provider: string; service: string; serviceDate: string; submittedDate: string; status: 'Pending' | 'Approved' | 'Denied'; billedAmount: number; allowedAmount: number | null; insurancePaid: number; memberResponsibility: number; deductibleApplied: number; oopApplied: number; notes: string; reviewNotes: string | null; version: number; coverageSnapshot: string | null };
type ClaimPage = { items: Claim[]; total: number; page: number; size: number };
type MemberCoverage = { memberName: string; planName: string; planId: number; benefitYear: number; coverageStatus: string; effectiveFrom: string; effectiveTo: string; deductibleTotal: number; deductibleMet: number; oopMaximum: number; oopSpent: number; items: { id: string; name: string; status: string; cost: string; notes: string }[] };
const money = (value: number | null | undefined) => value == null ? 'Not finalized' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

function ClaimFields({ memberId, saved }: { memberId: string; saved: (claim: Claim) => void }) {
  const { data, loading, error } = useApiData<MemberCoverage>(`/admin/claims/member-coverage?memberId=${encodeURIComponent(memberId)}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setFailure('');
    try { saved(await mutateApiData<Claim>('/admin/claims', 'POST', { memberId, coverageItemId: values.get('service'), provider: values.get('provider'), serviceDate: values.get('date'), billedAmount: Number(values.get('billed')), notes: values.get('notes') })); }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to create claim.'); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Loading assigned coverage...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!data) return null;
  return <><div className="claim-coverage-summary"><strong>{data.planName}</strong><p>Coverage: {formatDate(data.effectiveFrom)} through {formatDate(data.effectiveTo)} · {data.coverageStatus}</p><p>Deductible: {money(data.deductibleMet)} of {money(data.deductibleTotal)} · Out of pocket: {money(data.oopSpent)} of {money(data.oopMaximum)}</p></div>
    <ValidatedForm className="admin-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}><legend>Claim submission</legend>
      <label>Covered service / exclusion<select name="service" required defaultValue=""><option value="" disabled>Select a service</option>{data.items.map(item => <option value={item.id} key={item.id}>{item.name} · {item.status} · {item.cost}</option>)}</select></label>
      <label>Provider / facility<input name="provider" required maxLength={150} /></label>
      <label>Service date<input name="date" type="date" required min={data.effectiveFrom} max={data.effectiveTo < today() ? data.effectiveTo : today()} /></label>
      <label>Billed amount ($)<input name="billed" type="number" min="0" max="1000000" step="1" required /></label>
      <label className="claim-wide">Submission notes<textarea name="notes" maxLength={2000} rows={3} /></label>
    </fieldset>{failure && <p role="alert">{failure}</p>}<p className="admin-muted">Amounts use whole dollars. New claims start pending; no spending changes until an admin finalizes an approval.</p><button className="admin-primary" disabled={busy || data.coverageStatus !== 'Active' || !data.items.length}>{busy ? 'Creating...' : 'Create pending claim'}</button></ValidatedForm>
  </>;
}
function CreateClaim({ saved, cancel }: { saved: (claim: Claim) => void; cancel: () => void }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [member, setMember] = useState('');
  const { data, loading, error } = useApiData<MemberPage>(`/admin/members?size=100&search=${encodeURIComponent(query)}`);
  return <section className="admin-panel"><div className="admin-heading"><h2>Create a claim</h2><button onClick={cancel}>Cancel</button></div>
    <form className="admin-filters" onSubmit={event => { event.preventDefault(); setMember(''); setQuery(search); }}><label>Find a member<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Member name, ID, or email" maxLength={150} /></label><button>Search members</button></form>
    {loading && <p role="status">Loading members...</p>}{error && <p role="alert">{error}</p>}
    <label className="claim-member-picker">Member<select value={member} disabled={loading || !!error} onChange={e => setMember(e.target.value)}><option value="">Select a member</option>{data?.items.map(item => <option key={item.memberId} value={item.memberId}>{item.fullName} · {item.memberId}</option>)}</select></label>
    {data && data.totalElements > 100 && <p className="admin-muted">Showing the first 100 matches. Search by name or member ID to narrow the list.</p>}
    {data && !data.items.length && <p>No matching members found.</p>}
    {member && <ClaimFields key={member} memberId={member} saved={saved} />}
  </section>;
}
function ConfirmClaimCoverage({ claim, saved }: { claim: Claim; saved: (claim: Claim) => void }) {
  const { data, loading, error } = useApiData<MemberCoverage>(`/admin/claims/member-coverage?memberId=${encodeURIComponent(claim.memberId)}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setFailure('');
    try { saved(await mutateApiData<Claim>(`/admin/claims/${encodeURIComponent(claim.id)}/coverage`, 'POST', {
      version: claim.version, coverageItemId: values.get('coverageItem'), confirmed: values.get('confirmed') === 'on',
    })); } catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to confirm coverage.'); }
    finally { setBusy(false); }
  }
  const dateMatches = data && claim.serviceDate >= data.effectiveFrom && claim.serviceDate <= data.effectiveTo;
  return <section className="claim-coverage-setup"><h3>Confirm coverage for this historical claim</h3><p>This claim was created before coverage snapshots were recorded. Confirm the applicable plan and service to enable approval. This step does not approve the claim or change spending.</p>
    {loading && <p role="status">Loading member coverage...</p>}
    {error && <p role="alert">{error}</p>}
    <a href={`/admin/members/${encodeURIComponent(claim.memberId)}`}>Review this member’s plan →</a>
    {data && <><p><strong>{data.planName}</strong> · {formatDate(data.effectiveFrom)} through {formatDate(data.effectiveTo)}</p>
    {!dateMatches ? <p role="alert">This plan does not cover the claim’s service date. Review the member’s enrollment; do not approve against a different coverage period.</p> :
      <ValidatedForm className="admin-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}><legend>Applicable coverage</legend>
        <label>Applicable service<select name="coverageItem" required defaultValue=""><option value="" disabled>Select the applicable service</option>{data.items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status} · {item.cost}</option>)}</select></label>
        <label className="coverage-confirmation"><input name="confirmed" type="checkbox" required />I confirm this plan and service apply to the claim’s service date.</label>
      </fieldset>{failure && <p role="alert">{failure}</p>}<button className="admin-primary" disabled={busy}>{busy ? 'Confirming...' : 'Confirm claim coverage'}</button></ValidatedForm>}
    </>}
  </section>;
}
function ReviewClaim({ claim, saved, close }: { claim: Claim; saved: (claim: Claim) => void; close: () => void }) {
  const [status, setStatus] = useState(() => { try { return JSON.parse(claim.coverageSnapshot ?? 'null')?.service?.status === 'Not Covered' ? '' : 'Approved'; } catch { return 'Approved'; } });
  const [allocations, setAllocations] = useState({ paid: '', deductible: '0', oop: '0' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  let snapshot: { planName?: string; effectiveFrom?: string; effectiveTo?: string; service?: { status?: string; cost?: string; notes?: string } } | null = null;
  try { snapshot = claim.coverageSnapshot ? JSON.parse(claim.coverageSnapshot) : null; } catch { /* Historical claims can lack a snapshot. */ }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setError(''); setBusy(true);
    try {
      saved(await mutateApiData<Claim>(`/admin/claims/${encodeURIComponent(claim.id)}`, 'PATCH', { version: claim.version, status,
        allowedAmount: Number(values.get('allowed')), insurancePaid: status === 'Denied' ? 0 : Number(values.get('paid')),
        memberResponsibility: Number(values.get('member')), deductibleApplied: status === 'Denied' ? 0 : Number(values.get('deductible')),
        oopApplied: status === 'Denied' ? 0 : Number(values.get('oop')), reviewNotes: values.get('notes') }));
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to finalize claim.'); }
    finally { setBusy(false); }
  }
  const pending = claim.status === 'Pending';
  return <section className="admin-panel claim-review-panel"><div className="admin-heading"><div><p className="admin-eyebrow">{claim.status} · {claim.id}</p><h2>{claim.memberName}</h2></div><button onClick={close}>Close claim</button></div>
    <dl className="admin-member-meta"><div><dt>Provider</dt><dd>{claim.provider}</dd></div><div><dt>Service</dt><dd>{claim.service}</dd></div><div><dt>Service date</dt><dd>{formatDate(claim.serviceDate)}</dd></div><div><dt>Billed amount</dt><dd>{money(claim.billedAmount)}</dd></div></dl>
    {snapshot && <div className="claim-coverage-summary"><strong>{snapshot.planName}</strong><p>Coverage at submission: {formatDate(snapshot.effectiveFrom)} through {formatDate(snapshot.effectiveTo)}</p><p>{snapshot.service?.status} · {snapshot.service?.cost}</p><p>{snapshot.service?.notes}</p></div>}
    {claim.notes && <p>Submission notes: {claim.notes}</p>}
    {pending && !snapshot && <ConfirmClaimCoverage claim={claim} saved={saved} />}
    {pending ? <ValidatedForm className="admin-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}><legend>Review & finalize</legend>
      <label>Decision<select name="decision" required value={status} onChange={e => setStatus(e.target.value)}><option value="" disabled>Select a decision</option><option value="Approved" disabled={!!snapshot && snapshot.service?.status !== 'Covered'}>Approved</option><option>Denied</option></select></label>
      <p id="claim-payment-help" className="claim-wide claim-decision-note">{status === 'Denied' ? 'Insurance payment, deductible, and out-of-pocket allocations are zero for denied claims. Select Approved for a covered service to enter these amounts.' : 'Enter whole-dollar amounts in the fields below. Spending changes only after you finalize the claim.'}</p>
      <label>Allowed amount ($)<input name="allowed" type="number" min="0" max={claim.billedAmount} step="1" required /></label>
      <label>Insurance paid ($)<input name="paid" aria-describedby="claim-payment-help" value={status === 'Denied' ? '0' : allocations.paid} onChange={event => setAllocations(previous => ({ ...previous, paid: event.target.value }))} type="number" min="0" max={claim.billedAmount} step="1" required={status === 'Approved'} disabled={status === 'Denied'} /></label>
      <label>Member responsibility ($)<input name="member" type="number" min="0" max={claim.billedAmount} step="1" required /></label>
      <label>Apply to deductible ($)<input name="deductible" aria-describedby="claim-payment-help" value={status === 'Denied' ? '0' : allocations.deductible} onChange={event => setAllocations(previous => ({ ...previous, deductible: event.target.value }))} type="number" min="0" step="1" required={status === 'Approved'} disabled={status === 'Denied'} /></label>
      <label>Apply to out-of-pocket spending ($)<input name="oop" aria-describedby="claim-payment-help" value={status === 'Denied' ? '0' : allocations.oop} onChange={event => setAllocations(previous => ({ ...previous, oop: event.target.value }))} type="number" min="0" step="1" required={status === 'Approved'} disabled={status === 'Denied'} /></label>
      <label className="claim-wide">Review notes / reason<textarea name="notes" required maxLength={2000} rows={3} /></label>
    </fieldset><p className="admin-muted">Allowed amount must equal insurance paid plus member responsibility. Deductible allocation cannot exceed out-of-pocket allocation, and both must fit the member cost and remaining limits. Denied claims never increase spending. Finalized claims cannot be edited here.</p>
    {(!snapshot || snapshot.service?.status !== 'Covered') && <p role="status">{!snapshot ? 'Complete coverage confirmation above before finalizing an approval. The amount fields remain editable while you review.' : 'This service is excluded. Approval is unavailable; record the appropriate review outcome.'}</p>}
    {error && <p role="alert">{error}</p>}<button className="admin-primary" disabled={busy || !status || (status === 'Approved' && (!snapshot || snapshot.service?.status !== 'Covered'))}>{busy ? 'Finalizing...' : 'Finalize claim'}</button></ValidatedForm> : <><dl className="admin-member-meta"><div><dt>Allowed amount</dt><dd>{money(claim.allowedAmount)}</dd></div><div><dt>Insurance paid</dt><dd>{money(claim.insurancePaid)}</dd></div><div><dt>Member responsibility</dt><dd>{money(claim.memberResponsibility)}</dd></div><div><dt>Applied to deductible / out of pocket</dt><dd>{money(claim.deductibleApplied)} / {money(claim.oopApplied)}</dd></div></dl><p>{claim.reviewNotes}</p></>}
  </section>;
}
export default function AdminClaimsPage() {
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<Claim | null>(null); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [opening, setOpening] = useState(false);
  const { data, loading, error: loadError, reload } = useApiData<ClaimPage>(`/admin/claims?search=${encodeURIComponent(query)}&status=${status}&page=${page}`);
  async function open(id: string) { setOpening(true); setError(''); try { setSelected(await getApiData<Claim>(`/admin/claims/${encodeURIComponent(id)}`)); setCreating(false); } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to open claim.'); } finally { setOpening(false); } }
  function saved(claim: Claim) { setCreating(false); setSelected(claim); setNotice(claim.status === 'Pending' ? (selected?.id === claim.id ? 'Coverage confirmed. Review the payment fields, then finalize the claim.' : 'Pending claim created. No spending has been applied.') : 'Claim finalized. Approved spending allocations were applied once.'); reload(); }
  return <div className="admin-page"><div className="admin-heading"><div><p className="admin-eyebrow">CLAIMS, CLEARLY REVIEWED</p><h1>Claims Management</h1></div><button className="admin-primary" onClick={() => { setCreating(true); setSelected(null); setNotice(''); }}>Create claim</button></div><p>Review services against assigned coverage, record payment amounts, and finalize member claims.</p>
    {notice && <p role="status" className="success-notice">{notice}</p>}{error && <p role="alert">{error}</p>}
    {creating && <CreateClaim saved={saved} cancel={() => setCreating(false)} />}
    {selected && <ReviewClaim key={selected.id} claim={selected} saved={saved} close={() => setSelected(null)} />}
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(0); }}><label>Search claims<input maxLength={150} value={search} onChange={e => setSearch(e.target.value)} placeholder="Claim, member, provider, or service" /></label><button>Search</button><label>Claim status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">All statuses</option><option>Pending</option><option>Approved</option><option>Denied</option></select></label></form>
    {loading && <p role="status">Loading claims...</p>}{loadError && <div role="alert"><p>{loadError}</p><button onClick={reload}>Retry loading claims</button></div>}
    {data && <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Claim / member</th><th>Service / provider</th><th>Service date</th><th>Status</th><th className="table-money">Billed</th><th>Action</th></tr></thead><tbody>{data.items.map(claim => <tr key={claim.id}><td>{claim.id}<br /><strong>{claim.memberName}</strong></td><td>{claim.service}<br />{claim.provider}</td><td>{formatDate(claim.serviceDate)}</td><td><span className={`claim-status ${claim.status.toLowerCase()}`}>{claim.status}</span></td><td className="table-money">{money(claim.billedAmount)}</td><td><button disabled={opening} onClick={() => void open(claim.id)}>{claim.status === 'Pending' ? 'Review claim' : 'View claim'}</button></td></tr>)}</tbody></table></div>{!data.items.length && <p>No claims match your search.</p>}<div className="admin-pagination"><span>{data.total} claims · Page {page+1}</span><div className="admin-actions"><button disabled={!page || loading} onClick={() => setPage(value => value-1)}>Previous</button><button disabled={(page+1)*data.size >= data.total || loading} onClick={() => setPage(value => value+1)}>Next</button></div></div></>}
  </div>;
}
