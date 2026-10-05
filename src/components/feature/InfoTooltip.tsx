import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  text: string;
  label?: string;
  align?: 'start' | 'center' | 'end';
}

export default function InfoTooltip({ text, label = 'Mais informações', align = 'center' }: InfoTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 16, top: 16, width: 304 });
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(304, window.innerWidth - 32);
    const preferred = align === 'end' ? rect.right - width : align === 'center' ? rect.left + rect.width / 2 - width / 2 : rect.left;
    setPosition({ left: Math.max(16, Math.min(preferred, window.innerWidth - width - 16)), top: rect.bottom + 8, width });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return <span className={`wf-info-tooltip wf-info-tooltip--${align} ${open ? 'is-open' : ''}`} onMouseEnter={show} onMouseLeave={() => setOpen(false)} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="wf-info-tooltip__trigger" aria-label={label} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onFocus={show} onClick={show} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <i className="ri-information-line" aria-hidden="true" />
    </button>
    {open && createPortal(<span id={tooltipId} role="tooltip" className="wf-info-tooltip__floating" style={position}>{text}</span>, document.body)}
  </span>;
}
