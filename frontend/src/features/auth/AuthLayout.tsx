import type { ReactNode } from 'react';
import MotionArtwork from '../../components/MotionArtwork';
import BrandMark from '../../components/BrandMark';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-shell">
    <section className="auth-story" aria-label="Welcome to HealthBridge">
      <div className="auth-brand"><BrandMark /><span>HealthBridge<span className="brand-caption">INSURANCE</span></span></div>
      <div className="auth-introduction"><span className="auth-eyebrow">YOUR HEALTH. YOUR PEACE OF MIND.</span>
        <h2>Good health starts<br />with feeling looked after.</h2>
        <p>Your coverage, claims, and care resources. Connected in one place.</p>
        <ul className="auth-benefits"><li><span aria-hidden="true">01</span><div><strong>Understand your coverage</strong><p>Find plan details and track your benefits.</p></div></li><li><span aria-hidden="true">02</span><div><strong>Stay on top of your care</strong><p>Review claims, providers, and prescriptions.</p></div></li><li><span aria-hidden="true">03</span><div><strong>Keep your information close</strong><p>Access your member profile and digital ID.</p></div></li></ul>
      </div>
      <MotionArtwork />
      <p className="auth-story-footer">A healthier connection. Every step of the way.</p>
    </section>
    <section className="auth-form-panel"><div className="auth-form-container"><div className="auth-panel-identity" aria-label="HealthBridge Insurance"><BrandMark /><div><span className="auth-panel-wordmark">HealthBridge</span><span className="auth-panel-caption">INSURANCE</span></div></div>{children}<p className="auth-footnote">HealthBridge Insurance · Member &amp; administration access</p></div></section>
  </main>;
}
