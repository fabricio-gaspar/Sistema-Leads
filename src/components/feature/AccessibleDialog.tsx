import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Native modal: background inertness, keyboard focus containment and restoration. */
export default function AccessibleDialog({ children, onClose, className, title }: { children: ReactNode; onClose: () => void; className?: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const heading = dialog?.querySelector('h2,h3');
    if (dialog && heading) { if (!heading.id) heading.id = headingId; dialog.setAttribute('aria-labelledby', heading.id); }
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, [headingId]);
  return <dialog ref={ref} aria-label={title} className={`wf-accessible-dialog ${className ?? ''}`} onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0 && !element.closest('[inert],fieldset[disabled]'));
    const first = controls[0]; const last = controls.at(-1);
    if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
  }} onCancel={(event) => { event.preventDefault(); close.current(); }} onClick={(event) => { if (event.target === event.currentTarget) close.current(); }}>{children}</dialog>;
}
