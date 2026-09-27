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
  return <dialog ref={ref} aria-label={title} className={`wf-accessible-dialog ${className ?? ''}`} onCancel={(event) => { event.preventDefault(); close.current(); }} onClick={(event) => { if (event.target === event.currentTarget) close.current(); }}>{children}</dialog>;
}
