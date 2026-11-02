import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function DetailDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    return () => { dialog?.removeAttribute('open'); document.body.style.overflow = overflow; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="detail-dialog" aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>
    <header className="detail-dialog-header"><div><p>HEALTHBRIDGE · CARE DETAILS</p><h2 id={titleId}>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close details">Close <span aria-hidden="true">×</span></button></header>
    <div className="detail-dialog-content">{children}</div>
  </dialog>, document.body);
}
