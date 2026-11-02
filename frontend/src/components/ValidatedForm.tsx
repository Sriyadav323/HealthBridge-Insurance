import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, FormHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Props = Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  validate?: (form: HTMLFormElement) => Partial<Record<string, string>>;
  dirty?: boolean;
};
const isControl = (element: unknown): element is Control => element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;

function errorMessage(control: Control): string {
  if (control.validity.customError) return control.validationMessage;
  if (control.validity.valueMissing) return 'This field is required.';
  if (control.validity.typeMismatch) return 'Enter a valid email address.';
  if (control.validity.rangeUnderflow) return `Enter a value of at least ${control.getAttribute('min')}.`;
  if (control.validity.rangeOverflow) return `Enter a value no greater than ${control.getAttribute('max')}.`;
  if (control.validity.stepMismatch) return 'Enter a whole number.';
  if (control.validity.badInput) return 'Enter a valid value.';
  return control.validationMessage;
}

export default function ValidatedForm({ children, onSubmit, validate, dirty = false, ...props }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const [errors, setErrors] = useState<Control[]>([]);
  const submitted = useRef(false);
  function applyRules(form: HTMLFormElement) {
    const controls = Array.from(form.elements).filter(isControl);
    controls.forEach(control => {
      control.setCustomValidity('');
      if (control instanceof HTMLInputElement && control.required && ['text', 'search', 'tel'].includes(control.type) && control.value && !control.value.trim()) control.setCustomValidity('Enter a value that is not only spaces.');
    });
    const custom = validate?.(form) ?? {};
    Object.entries(custom).forEach(([name, message]) => {
      const control = form.elements.namedItem(name);
      if (isControl(control) && message) control.setCustomValidity(message);
    });
    return controls;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); submitted.current = true;
    const invalid = applyRules(event.currentTarget).filter(control => control.willValidate && !control.validity.valid);
    setErrors(invalid);
    if (invalid.length) { invalid[0].focus(); return; }
    onSubmit(event);
  }
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const observer = new MutationObserver(records => {
      if (!records.some(record => record.removedNodes.length > 0)) return;
      setErrors(previous => {
        const connected = previous.filter(control => control.isConnected);
        return connected.length === previous.length ? previous : connected;
      });
    });
    observer.observe(form, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const cleanup = errors.map((control, index) => {
      const original = control.getAttribute('aria-describedby');
      const originalLabel = control.getAttribute('aria-label');
      const label = control.closest('label')?.cloneNode(true) as HTMLElement | undefined;
      label?.querySelectorAll('input,select,textarea,.field-validation-error').forEach(node => node.remove());
      if (!originalLabel && label?.textContent?.trim()) control.setAttribute('aria-label', label.textContent.trim());
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', [original, `${prefix}-${index}`].filter(Boolean).join(' '));
      return () => { if (originalLabel) control.setAttribute('aria-label', originalLabel); else control.removeAttribute('aria-label'); control.removeAttribute('aria-invalid'); if (original) control.setAttribute('aria-describedby', original); else control.removeAttribute('aria-describedby'); };
    });
    return () => cleanup.forEach(clean => clean());
  }, [errors, prefix]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href], [data-leave-form]') : null;
      if (!target) return;
      if (target instanceof HTMLAnchorElement) {
        if (target.target === '_blank' || target.hasAttribute('download') || target.href === window.location.href) return;
        const url = new URL(target.href);
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      }
      if (!window.confirm('You have unsaved changes. Leave this form and discard them?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', leave, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leave, true); };
  }, [dirty]);
  return <form {...props} ref={ref} noValidate onSubmit={submit}
    onBlurCapture={event => {
      props.onBlurCapture?.(event);
      if (isControl(event.target)) {
        const control = event.target;
        applyRules(event.currentTarget);
        setErrors(previous => [...previous.filter(item => item !== control && item.isConnected && !item.validity.valid), ...(control.willValidate && !control.validity.valid ? [control] : [])]);
      }
    }}
    onInputCapture={event => {
      props.onInputCapture?.(event);
      if (submitted.current || errors.length) setErrors(applyRules(event.currentTarget).filter(control => control.willValidate && !control.validity.valid));
    }}>
    {errors.length > 0 && <div className="form-error-summary" role="alert">Please check {errors.length === 1 ? 'the highlighted field' : `${errors.length} highlighted fields`} before saving.</div>}
    {children}
    {errors.map((control, index) => {
      const label = control.closest('label');
      return label ? createPortal(<span className="field-validation-error" id={`${prefix}-${index}`} aria-hidden="true">{errorMessage(control)}</span>, label, `${prefix}-${index}`) : null;
    })}
  </form>;
}
