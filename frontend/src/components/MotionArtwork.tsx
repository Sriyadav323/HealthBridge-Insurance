import { useState } from 'react';

export default function MotionArtwork() {
  const [paused, setPaused] = useState(false);
  return <div className={`brand-motion${paused ? ' brand-motion-paused' : ''}`}>
    <div className="brand-motion-stage" aria-hidden="true">
      <div className="brand-motion-glow" />
      <div className="brand-motion-ring brand-motion-ring-one"><span /></div>
      <div className="brand-motion-ring brand-motion-ring-two"><span /></div>
      <span className="brand-motion-star">✦</span>
      <div className="brand-motion-card"><span>HealthBridge <b>+</b></span><small>CARE, CONNECTED.</small><strong>A healthier<br />connection.</strong><i>✦</i></div>
      <span className="brand-motion-chip">Coverage. Care. Confidence.</span>
    </div>
    <button type="button" className="brand-motion-toggle" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '▶ Play effects' : 'Ⅱ Pause effects'}</button>
    <span className="brand-motion-reduced">Reduced motion enabled</span>
  </div>;
}
