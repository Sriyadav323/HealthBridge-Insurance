import { useEffect, useState } from 'react';
import { getApiData, mutateApiData } from '../../../services/api';
import '../../shared/FeaturePages.css';

type Profile = { memberId: string; fullName: string; email: string; phone: string | null; address: string | null; planName: string; planType: string; coverageStatus: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getApiData<Profile>('/members/me/profile', controller.signal)
      .then(p => { if (!controller.signal.aborted) { setProfile(p); setPhone(p.phone ?? ''); setAddress(p.address ?? ''); } })
      .catch(e => { if (!controller.signal.aborted) setError(String(e)); });
    return () => controller.abort();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      setProfile(await mutateApiData<Profile>('/members/me/profile', 'PATCH', { phone, address })); setMessage('Contact information saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }
  return <div className="feature-page"><h1>My Profile</h1><p>View your account and update your contact information.</p>
    {error && <p role="alert" className="feature-error">{error}</p>}
    {!profile && !error && <p role="status">Loading profile...</p>}
    {profile && <><section className="feature-panel"><h2>Member details</h2><dl className="feature-details">
      <div><dt>Full name</dt><dd>{profile.fullName}</dd></div><div><dt>Member ID</dt><dd>{profile.memberId}</dd></div>
      <div><dt>Email</dt><dd>{profile.email}</dd></div><div><dt>Insurance plan</dt><dd>{profile.planName}</dd></div>
      <div><dt>Plan type</dt><dd>{profile.planType}</dd></div><div><dt>Coverage status</dt><dd>{profile.coverageStatus}</dd></div>
    </dl></section><section className="feature-panel"><h2>Contact information</h2><form onSubmit={save} className="feature-form" aria-busy={saving}>
      <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} disabled={saving} autoComplete="tel" type="tel" maxLength={30} placeholder="(555) 555-0123" /></label>
      <label>Mailing address<input value={address} onChange={e => setAddress(e.target.value)} disabled={saving} autoComplete="street-address" maxLength={255} placeholder="Street, city, state, ZIP" /></label>
      <button disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>{message && <p role="status">{message}</p>}
    </form></section></>}
  </div>;
}
