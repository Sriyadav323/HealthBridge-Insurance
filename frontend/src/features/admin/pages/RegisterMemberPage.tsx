import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mutateApiData } from '../../../services/api';
import MemberForm from '../components/MemberForm';
import SetupLinkNotice from '../components/SetupLinkNotice';
import type { MemberWrite, Registration } from '../types/admin.types';
import '../Admin.css';

export default function RegisterMemberPage() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [registration, setRegistration] = useState<Registration | null>(null);
  async function save(input: MemberWrite) {
    setSaving(true); setError('');
    try { setRegistration(await mutateApiData<Registration>('/admin/members', 'POST', input)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Registration failed.'); }
    finally { setSaving(false); }
  }
  return <div className="admin-page"><p className="admin-eyebrow">New member enrollment</p><h1>Register Member</h1>
    <p>Create a synthetic member record and a MEMBER login account. The member chooses their own password through a private, one-time link.</p>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {registration ? <><p role="status">{registration.details.summary.fullName} registered successfully. Member ID: {registration.details.summary.memberId}.</p>
      <SetupLinkNotice registration={registration} />
      <div className="admin-actions"><Link to={`/admin/members/${registration.details.summary.memberId}`}>View member details</Link><button onClick={() => setRegistration(null)}>Register another member</button></div>
    </> : <section className="admin-panel"><MemberForm saving={saving} submitLabel="Register member" onSave={save} /></section>}
  </div>;
}
