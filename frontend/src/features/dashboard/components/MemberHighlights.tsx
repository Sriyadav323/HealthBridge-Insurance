import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const highlights = [
  { label: 'Coverage highlights', eyebrow: 'A LITTLE CLARITY. A LOT OF CONFIDENCE.', title: ['Your health.', 'Your next chapter.'], description: 'Benefits, care, and everyday peace of mind. All in one thoughtful space.', action: 'Explore your benefits', path: '/benefits', cardTitle: 'Your coverage, connected.', cardLabel: 'BENEFITS FOR YOUR EVERYDAY' },
  { label: 'Find care', eyebrow: 'CARE THAT FITS YOUR LIFE', title: ['Find your people.', 'Feel your best.'], description: 'Explore in-network providers and find the right care for your needs.', action: 'Find a doctor', path: '/providers', cardTitle: 'Care starts with connection.', cardLabel: 'YOUR NEXT STEP TO FEELING BETTER' },
  { label: 'Digital member card', eyebrow: 'ALWAYS WITHIN REACH', title: ['Less searching.', 'More living.'], description: 'Your digital member ID, ready whenever you need it. Keep your coverage close.', action: 'View digital ID', path: '/id-card', cardTitle: 'HealthBridge +', cardLabel: 'YOUR DIGITAL MEMBER CARD' },
];

export default function MemberHighlights() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const change = () => setReducedMotion(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const rotating = !paused && !hovered && !focused && !reducedMotion;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % highlights.length), 8000);
    return () => window.clearInterval(timer);
  }, [rotating, index]);
  const highlight = highlights[index];
  function choose(next: number) { setPaused(true); setIndex((next + highlights.length) % highlights.length); }
  return <section className={`member-highlights${rotating ? ' motion-playing' : ' motion-paused'}`} aria-label="Featured member resources" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className={`highlight-banner highlight-${index}`} aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
      <div className="highlight-copy" key={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${highlights.length}: ${highlight.label}`}>
        <p className="premium-eyebrow">{highlight.eyebrow}</p>
        <h2>{highlight.title[0]}<br />{highlight.title[1]}</h2>
        <p className="highlight-description">{highlight.description}</p>
        <Link to={highlight.path}>{highlight.action} <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="highlight-art" aria-hidden="true"><div className="highlight-orbit" /><span className="promo-spark promo-spark-one">✦</span><span className="promo-spark promo-spark-two">+</span><span className="promo-orb" /><div className="highlight-card"><span className="highlight-card-brand">HealthBridge <span>+</span></span><small>{highlight.cardLabel}</small><strong>{highlight.cardTitle}</strong><span className="highlight-card-bottom">A healthier connection. <span>✦</span></span></div></div>
    </div>
    <div className="highlight-controls"><span className="highlight-caption">{String(index + 1).padStart(2, '0')} / 03 · {highlight.label}</span>
      <div className="highlight-buttons"><button type="button" aria-label="Previous banner" onClick={() => choose(index - 1)}>←</button>
        {highlights.map((item, itemIndex) => <button type="button" className="highlight-dot" key={item.label} aria-label={`Show ${item.label}`} aria-pressed={index === itemIndex} onClick={() => choose(itemIndex)}><span /></button>)}
        <button type="button" aria-label="Next banner" onClick={() => choose(index + 1)}>→</button>
        {!reducedMotion && <button type="button" className="highlight-pause" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume banner rotation' : 'Pause banner rotation'}>{paused ? 'Play' : 'Pause'}</button>}
      </div>
    </div>
  </section>;
}
