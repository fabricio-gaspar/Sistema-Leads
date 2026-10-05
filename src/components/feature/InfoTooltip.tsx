import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
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
  const floating = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  const [position, setPosition] = useState<CSSProperties>({ left: 16, top: 16, width: 304 });
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null; };
  const leave = () => {
    hovered.current = false; cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!hovered.current && document.activeElement !== trigger.current && !floating.current?.contains(document.activeElement)) setOpen(false);
    }, 150);
  };
  const show = () => {
    cancelClose();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(304, window.innerWidth - 32);
    const preferred = align === 'end' ? rect.right - width : align === 'center' ? rect.left + rect.width / 2 - width / 2 : rect.left;
    const above = window.innerHeight - rect.bottom < 160 && rect.top > 160;
    setPosition({ left: Math.max(16, Math.min(preferred, window.innerWidth - width - 16)),
      ...(above ? { bottom: window.innerHeight - rect.top, paddingBottom: 8 } : { top: rect.bottom, paddingTop: 8 }), width });
    setOpen(true);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const scroll = (event: Event) => { if (!floating.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } };
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !floating.current?.contains(event.target as Node)) close(); };
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  return <span className={`wf-info-tooltip wf-info-tooltip--${align} ${open ? 'is-open' : ''}`} onMouseEnter={() => { hovered.current = true; show(); }} onMouseLeave={leave} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget) && !floating.current?.contains(event.relatedTarget)) leave();
  }}>
    <button ref={trigger} type="button" className="wf-info-tooltip__trigger" aria-label={label} aria-describedby={open ? tooltipId : undefined} aria-expanded={open} onFocus={show} onClick={show} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <i className="ri-information-line" aria-hidden="true" />
    </button>
    {open && createPortal(<span ref={floating} className="wf-info-tooltip__portal" style={position} onMouseEnter={() => { hovered.current = true; cancelClose(); }} onMouseLeave={leave}>
      <span id={tooltipId} role="tooltip" className="wf-info-tooltip__floating">{text}</span>
    </span>, document.body)}
  </span>;
}
