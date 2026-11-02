import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApiData } from '../../../hooks/useApiData';
import { mutateApiData } from '../../../services/api';
import MemberForm from '../components/MemberForm';
import SetupLinkNotice from '../components/SetupLinkNotice';
import { accountStatus } from '../types/admin.types';
import type { MemberDetails, MemberWrite, Registration } from '../types/admin.types';
import '../Admin.css';

export default function MemberDetailsPage() {
  const { id = '' } = useParams();
  return <MemberEditor key={id} id={id} />;
}

function MemberEditor({ id }: { id: string }) {
  const path = `/admin/members/${encodeURIComponent(id)}`;
  const { data, loading, error, reload } = useApiData<MemberDetails>(path);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [registration, setRegistration] = useState<Registration | null>(null);
  async function save(input: MemberWrite) {
    if (!window.confirm('Save these member changes? Changes to the login email sign the member out.')) return;
    setSaving(true); setFailure(''); setNotice(''); setRegistration(null);
    try { await mutateApiData(path, 'PATCH', input); setNotice('Member information updated.'); reload(); }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to update member.'); }
    finally { setSaving(false); }
  }
  async function account() {
    if (!data) return;
    const enabled = data.summary.passwordSetupRequired ? false : !data.summary.accountEnabled;
    if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} login for ${data.summary.fullName}? ${enabled ? 'The member will be able to sign in.' : 'Existing sessions and outstanding setup links will be revoked.'}`)) return;
    setSaving(true); setFailure(''); setNotice(''); setRegistration(null);
    try { await mutateApiData(`${path}/account`, 'PATCH', { enabled, version: data.summary.version }); setNotice(`Login ${enabled ? 'enabled' : 'disabled'}.`); reload(); }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to change account.'); }
    finally { setSaving(false); }
  }
  async function reissue() {
    if (!data || !window.confirm('Issue a new password setup link? Any previous setup link will stop working.')) return;
    setSaving(true); setFailure(''); setNotice(''); setRegistration(null);
    try { setRegistration(await mutateApiData<Registration>(`${path}/password-setup`, 'POST', { version: data.summary.version })); reload(); }
    catch (problem) { setFailure(problem instanceof Error ? problem.message : 'Unable to issue setup link.'); }
    finally { setSaving(false); }
  }
  return <div className="admin-page"><Link to="/admin/members">← Member Management</Link><h1>Member details</h1>
    {loading && <p role="status">Loading member details...</p>}
    {(error || failure) && <div role="alert" className="admin-error"><p>{error || failure}</p><button disabled={loading || saving} onClick={() => { setFailure(''); setRegistration(null); reload(); }}>Reload record</button></div>}
    {notice && <p role="status" className="success-notice">{notice}</p>}
    {registration && <SetupLinkNotice registration={registration} />}
    {data && <><section className="admin-panel"><h2>{data.summary.fullName}</h2><dl className="admin-member-meta"><div><dt>Member ID</dt><dd>{data.summary.memberId}</dd></div><div><dt>Login account</dt><dd>{accountStatus(data.summary)}</dd></div><div><dt>Registered</dt><dd>{data.summary.registeredAt ? new Date(data.summary.registeredAt).toLocaleString() : 'Historical date unknown'}</dd></div></dl>
      <div className="admin-actions">
        {data.summary.accountEnabled !== null && <button className={data.summary.accountEnabled ? 'admin-danger' : ''} disabled={saving} onClick={() => void account()}>{data.summary.passwordSetupRequired ? 'Revoke setup link' : data.summary.accountEnabled ? 'Disable login' : 'Enable login'}</button>}
        {data.summary.passwordSetupRequired && <button disabled={saving} onClick={() => void reissue()}>Issue new setup link</button>}
      </div>
      {data.summary.passwordSetupRequired && <p>Login becomes enabled after password setup. Use “Issue new setup link” if the original expired, was revoked, or the member’s email changed.</p>}
    </section><section className="admin-panel"><h2>Edit member information</h2><MemberForm key={`${id}-${data.summary.version}`} initial={data} saving={saving} submitLabel="Save changes" onSave={save} /></section></>}
  </div>;
}
