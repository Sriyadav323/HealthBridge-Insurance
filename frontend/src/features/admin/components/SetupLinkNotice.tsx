import type { Registration } from '../types/admin.types';

export default function SetupLinkNotice({ registration }: { registration: Registration }) {
  const url = `${window.location.origin}/set-password#token=${encodeURIComponent(registration.setupToken)}`;
  return <section className="admin-notice" aria-label="One-time password setup">
    <h2>Share the password setup link privately</h2>
    <p>The account cannot sign in until the member sets their password. This link is shown only here and expires {new Date(registration.setupExpiresAt).toLocaleString()}.</p>
    <label>One-time setup link<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>
    <p>Copy the link to the member through a trusted channel. For a local demo, open it in a separate private browser window. Never add it to logs, screenshots, or public documentation.</p>
  </section>;
}
