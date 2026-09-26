import { useId, useState } from 'react';

interface InfoTooltipProps {
  text: string;
  label?: string;
  align?: 'start' | 'center' | 'end';
}

export default function InfoTooltip({ text, label = 'Mais informações', align = 'center' }: InfoTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return <span className={`wf-info-tooltip wf-info-tooltip--${align} ${open ? 'is-open' : ''}`} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button type="button" className="wf-info-tooltip__trigger" aria-label={label} aria-describedby={tooltipId} aria-expanded={open} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <i className="ri-information-line" aria-hidden="true" />
    </button>
    <span id={tooltipId} role="tooltip" className="wf-info-tooltip__bubble">{text}</span>
  </span>;
}
